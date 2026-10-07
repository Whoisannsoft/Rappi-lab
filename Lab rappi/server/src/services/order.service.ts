import pool from '../db';
import { Order, OrderStatus } from '../types';

export class OrderService {
  /**
   * Crear orden (Consumer).
   * REGLA ESTRICTA DEL PDF: Validar en la capa de Service que la tienda se encuentre abierta (is_open: true).
   */
  static async createOrder(
    clientId: string,
    storeId: string,
    items: { product_id: string; quantity: number }[]
  ): Promise<string> {
    if (!storeId) {
      throw new Error('El ID de la tienda es requerido.');
    }
    if (!items || items.length === 0) {
      throw new Error('Debe incluir al menos un producto en la orden.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // VALIDACIÓN EN CAPA DE SERVICE: Verificar existencia y estado is_open de la tienda
      const storeRes = await client.query(
        'SELECT id, name, is_open FROM stores WHERE id = $1',
        [storeId]
      );

      if (storeRes.rows.length === 0) {
        throw new Error('La tienda no existe.');
      }

      const store = storeRes.rows[0];
      if (!store.is_open) {
        throw new Error('No es posible realizar órdenes: La tienda se encuentra cerrada (is_open: false).');
      }

      // Validar y crear la orden con estado 'waiting_for_deliver'
      const orderRes = await client.query(
        `INSERT INTO orders (client_id, store_id, status, created_at) 
         VALUES ($1, $2, 'waiting_for_deliver', CURRENT_TIMESTAMP) 
         RETURNING id`,
        [clientId, storeId]
      );
      const orderId: string = orderRes.rows[0].id;

      // Insertar items de la orden
      for (const item of items) {
        if (!item.product_id || item.quantity <= 0) {
          throw new Error('Cada producto debe tener un ID válido y cantidad mayor a cero.');
        }

        // Verificar que el producto pertenezca a la tienda
        const prodRes = await client.query(
          'SELECT id FROM products WHERE id = $1 AND store_id = $2',
          [item.product_id, storeId]
        );
        if (prodRes.rows.length === 0) {
          throw new Error(`El producto con ID ${item.product_id} no pertenece a esta tienda.`);
        }

        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
          [orderId, item.product_id, item.quantity]
        );
      }

      await client.query('COMMIT');
      return orderId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Pantalla 3 Consumer: Consultar sus órdenes realizadas y su estado
   */
  static async getOrdersByClient(clientId: string): Promise<Order[]> {
    const res = await pool.query(
      `SELECT 
        o.id,
        o.client_id,
        o.delivery_id,
        o.store_id,
        o.status,
        o.created_at,
        s.name AS store_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', p.id,
              'product_name', p.name,
              'price', p.price,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.client_id = $1
       GROUP BY o.id, s.name
       ORDER BY o.created_at DESC`,
      [clientId]
    );
    return res.rows;
  }

  /**
   * Admin Tienda: Ver las órdenes asociadas a su tienda
   */
  static async getOrdersByStoreOwner(ownerId: string): Promise<Order[]> {
    const res = await pool.query(
      `SELECT 
        o.id,
        o.client_id,
        o.delivery_id,
        o.store_id,
        o.status,
        o.created_at,
        u.name AS client_name,
        s.name AS store_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', p.id,
              'product_name', p.name,
              'price', p.price,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.client_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE s.user_owner_id = $1
       GROUP BY o.id, u.name, s.name
       ORDER BY o.created_at DESC`,
      [ownerId]
    );
    return res.rows;
  }

  /**
   * Domiciliario: Ver la lista de órdenes disponibles para entrega
   * (sin tomar por otro domiciliario, status waiting_for_deliver y delivery_id IS NULL)
   */
  static async getAvailableOrders(): Promise<Order[]> {
    const res = await pool.query(
      `SELECT 
        o.id,
        o.client_id,
        o.delivery_id,
        o.store_id,
        o.status,
        o.created_at,
        s.name AS store_name,
        u.name AS client_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', p.id,
              'product_name', p.name,
              'price', p.price,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.client_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.status = 'waiting_for_deliver' AND o.delivery_id IS NULL
       GROUP BY o.id, s.name, u.name
       ORDER BY o.created_at ASC`
    );
    return res.rows;
  }

  /**
   * Domiciliario: Aceptar orden.
   * REGLA ESTRICTA: Si la orden ya se encuentra aceptada por otro domiciliario, deberá retornar error.
   */
  static async acceptOrder(orderId: string, deliveryId: string): Promise<Order> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentOrderRes = await client.query(
        'SELECT id, delivery_id, status FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (currentOrderRes.rows.length === 0) {
        throw new Error('La orden no existe.');
      }

      const currentOrder = currentOrderRes.rows[0];

      if (currentOrder.delivery_id !== null || currentOrder.status !== 'waiting_for_deliver') {
        throw new Error('Esta orden ya fue aceptada por otro domiciliario o ya no se encuentra disponible.');
      }

      const updateRes = await client.query(
        `UPDATE orders 
         SET delivery_id = $1, status = 'in_progress' 
         WHERE id = $2 
         RETURNING id, client_id, delivery_id, store_id, status, created_at`,
        [deliveryId, orderId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Domiciliario: Rechazar o soltar la orden (regresar a 'waiting_for_deliver' y delivery_id = NULL)
   * o marcar como entregada ('delivered').
   */
  static async updateOrderStatus(
    orderId: string,
    deliveryId: string,
    targetStatus: 'waiting_for_deliver' | 'delivered'
  ): Promise<Order> {
    if (!['waiting_for_deliver', 'delivered'].includes(targetStatus)) {
      throw new Error("Estado no válido. Solo puede ser 'waiting_for_deliver' o 'delivered'.");
    }

    let query = '';
    let params: any[] = [];

    if (targetStatus === 'waiting_for_deliver') {
      // Soltar o rechazar la orden: regresa a waiting_for_deliver y delivery_id queda NULL
      query = `UPDATE orders 
               SET status = 'waiting_for_deliver', delivery_id = NULL 
               WHERE id = $1 AND delivery_id = $2 
               RETURNING id, client_id, delivery_id, store_id, status, created_at`;
      params = [orderId, deliveryId];
    } else {
      // Marcar como entregada
      query = `UPDATE orders 
               SET status = 'delivered' 
               WHERE id = $1 AND delivery_id = $2 
               RETURNING id, client_id, delivery_id, store_id, status, created_at`;
      params = [orderId, deliveryId];
    }

    const res = await pool.query(query, params);
    if (res.rows.length === 0) {
      throw new Error('No fue posible actualizar el estado: la orden no pertenece a este domiciliario o no está activa.');
    }

    return res.rows[0];
  }

  /**
   * Domiciliario: Ver historial y estado de órdenes aceptadas por el domiciliario
   */
  static async getOrdersByDeliveryDriver(deliveryId: string): Promise<Order[]> {
    const res = await pool.query(
      `SELECT 
        o.id,
        o.client_id,
        o.delivery_id,
        o.store_id,
        o.status,
        o.created_at,
        s.name AS store_name,
        u.name AS client_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', p.id,
              'product_name', p.name,
              'price', p.price,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.client_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.delivery_id = $1
       GROUP BY o.id, s.name, u.name
       ORDER BY o.created_at DESC`,
      [deliveryId]
    );
    return res.rows;
  }
}
