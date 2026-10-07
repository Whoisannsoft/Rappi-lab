import pool from '../db';
import { Store, Product } from '../types';

export class StoreService {
  /**
   * Pantalla 1 Consumer: Ver solo tiendas abiertas
   */
  static async getOpenStores(): Promise<Store[]> {
    const res = await pool.query(
      'SELECT id, name, is_open FROM stores WHERE is_open = true ORDER BY name ASC'
    );
    return res.rows;
  }

  /**
   * Obtener detalle de tienda por ID
   */
  static async getStoreById(storeId: string): Promise<Store | null> {
    const res = await pool.query(
      'SELECT id, name, is_open, user_owner_id FROM stores WHERE id = $1',
      [storeId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Pantalla 2 Consumer / Store: Ver productos de una tienda
   */
  static async getProductsByStore(storeId: string): Promise<Product[]> {
    const res = await pool.query(
      'SELECT id, name, price, store_id FROM products WHERE store_id = $1 ORDER BY name ASC',
      [storeId]
    );
    return res.rows;
  }

  /**
   * Admin Tienda: Ver la información de su tienda
   */
  static async getStoreByOwner(ownerId: string): Promise<Store | null> {
    const res = await pool.query(
      'SELECT id, name, is_open, user_owner_id FROM stores WHERE user_owner_id = $1',
      [ownerId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Admin Tienda: Alternar el estado de la tienda entre Abierta/Cerrada (is_open)
   */
  static async toggleStoreStatus(ownerId: string): Promise<Store> {
    const res = await pool.query(
      'UPDATE stores SET is_open = NOT is_open WHERE user_owner_id = $1 RETURNING id, name, is_open, user_owner_id',
      [ownerId]
    );
    if (res.rows.length === 0) {
      throw new Error('Tienda no encontrada para este usuario.');
    }
    return res.rows[0];
  }

  /**
   * Admin Tienda: Crear un producto
   */
  static async createProduct(ownerId: string, name: string, price: number): Promise<Product> {
    if (!name || !name.trim()) {
      throw new Error('El nombre del producto es obligatorio.');
    }
    if (price === undefined || price === null || price < 0) {
      throw new Error('El precio debe ser un número entero mayor o igual a 0.');
    }

    const store = await this.getStoreByOwner(ownerId);
    if (!store) {
      throw new Error('Tienda no encontrada para este usuario.');
    }

    const res = await pool.query(
      'INSERT INTO products (name, price, store_id) VALUES ($1, $2, $3) RETURNING id, name, price, store_id',
      [name.trim(), Math.round(price), store.id]
    );
    return res.rows[0];
  }

  /**
   * Admin Tienda: Actualizar el nombre de los productos pertenecientes a la tienda
   */
  static async updateProduct(ownerId: string, productId: string, name: string, price?: number): Promise<Product> {
    if (!name || !name.trim()) {
      throw new Error('El nombre del producto no puede estar vacío.');
    }

    const store = await this.getStoreByOwner(ownerId);
    if (!store) {
      throw new Error('Tienda no encontrada para este usuario.');
    }

    let query = 'UPDATE products SET name = $1';
    const params: any[] = [name.trim(), productId, store.id];

    if (price !== undefined && price !== null) {
      query += ', price = $4';
      params.push(Math.round(price));
    }

    query += ' WHERE id = $2 AND store_id = $3 RETURNING id, name, price, store_id';

    const res = await pool.query(query, params);
    if (res.rows.length === 0) {
      throw new Error('Producto no encontrado o no pertenece a su tienda.');
    }
    return res.rows[0];
  }

  /**
   * Admin Tienda: Obtener todos los productos de la tienda del usuario
   */
  static async getMyStoreProducts(ownerId: string): Promise<Product[]> {
    const store = await this.getStoreByOwner(ownerId);
    if (!store) {
      throw new Error('Tienda no encontrada para este usuario.');
    }
    return this.getProductsByStore(store.id);
  }
}
