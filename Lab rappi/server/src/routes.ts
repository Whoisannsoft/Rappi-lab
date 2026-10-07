import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import { authMiddleware } from './middleware';

const router = Router();
const SECRET_KEY = process.env.JWT_SECRET || 'secret';

// Auth Routes
router.post('/auth/register', async (req, res) => {
  const { name, email, password, role, storeName } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
        [name, email, hashedPassword, role]
      );
      const user = userRes.rows[0];

      if (role === 'store') {
        if (!storeName) {
          throw new Error('storeName is required for store role');
        }
        await client.query(
          'INSERT INTO stores (name, owner_id) VALUES ($1, $2)',
          [storeName, user.id]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(user);
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Consumer Routes
router.get('/stores', authMiddleware(['consumer']), async (req, res) => {
  try {
    const storesRes = await pool.query('SELECT * FROM stores WHERE is_open = true');
    res.json(storesRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stores/:id/products', authMiddleware(['consumer']), async (req, res) => {
  try {
    const productsRes = await pool.query('SELECT * FROM products WHERE store_id = $1', [req.params.id]);
    res.json(productsRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', authMiddleware(['consumer']), async (req: any, res) => {
  const { store_id, items } = req.body; // items: { product_id, quantity }[]
  const consumer_id = req.user.id;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const storeRes = await client.query('SELECT is_open FROM stores WHERE id = $1', [store_id]);
      if (storeRes.rows.length === 0 || !storeRes.rows[0].is_open) {
         throw new Error('Store is closed or does not exist');
      }

      const orderRes = await client.query(
        'INSERT INTO orders (consumer_id, store_id) VALUES ($1, $2) RETURNING id',
        [consumer_id, store_id]
      );
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
          [orderId, item.product_id, item.quantity]
        );
      }
      
      await client.query('COMMIT');
      res.status(201).json({ id: orderId });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/consumer/orders', authMiddleware(['consumer']), async (req: any, res) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, s.name as store_name, 
       json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity)) as items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.consumer_id = $1
       GROUP BY o.id, s.name`,
      [req.user.id]
    );
    res.json(ordersRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Store Routes
router.get('/store/info', authMiddleware(['store']), async (req: any, res) => {
  try {
    const storeRes = await pool.query('SELECT * FROM stores WHERE owner_id = $1', [req.user.id]);
    res.json(storeRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/store/toggle', authMiddleware(['store']), async (req: any, res) => {
  try {
    const storeRes = await pool.query('UPDATE stores SET is_open = NOT is_open WHERE owner_id = $1 RETURNING *', [req.user.id]);
    res.json(storeRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/store/products', authMiddleware(['store']), async (req: any, res) => {
  const { name } = req.body;
  try {
    const storeRes = await pool.query('SELECT id FROM stores WHERE owner_id = $1', [req.user.id]);
    if (storeRes.rows.length === 0) return res.status(404).json({ error: 'Store not found' });
    const store_id = storeRes.rows[0].id;
    
    const productRes = await pool.query(
      'INSERT INTO products (name, store_id) VALUES ($1, $2) RETURNING *',
      [name, store_id]
    );
    res.json(productRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/store/products/:id', authMiddleware(['store']), async (req: any, res) => {
  const { name } = req.body;
  try {
    const productRes = await pool.query(
      'UPDATE products SET name = $1 WHERE id = $2 AND store_id = (SELECT id FROM stores WHERE owner_id = $3) RETURNING *',
      [name, req.params.id, req.user.id]
    );
    res.json(productRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/store/products', authMiddleware(['store']), async (req: any, res) => {
  try {
    const productsRes = await pool.query(
      'SELECT p.* FROM products p JOIN stores s ON p.store_id = s.id WHERE s.owner_id = $1',
      [req.user.id]
    );
    res.json(productsRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/store/orders', authMiddleware(['store']), async (req: any, res) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, u.name as consumer_name,
       json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity)) as items
       FROM orders o
       JOIN users u ON o.consumer_id = u.id
       JOIN stores s ON o.store_id = s.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE s.owner_id = $1
       GROUP BY o.id, u.name`,
      [req.user.id]
    );
    res.json(ordersRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delivery Routes
router.get('/delivery/available-orders', authMiddleware(['delivery']), async (req, res) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, s.name as store_name, u.name as consumer_name,
       json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity)) as items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.consumer_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.status = 'waiting_for_deliver' AND o.delivery_id IS NULL
       GROUP BY o.id, s.name, u.name`
    );
    res.json(ordersRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/delivery/orders/:id/accept', authMiddleware(['delivery']), async (req: any, res) => {
  try {
    const orderRes = await pool.query(
      `UPDATE orders SET delivery_id = $1, status = 'in_progress'
       WHERE id = $2 AND status = 'waiting_for_deliver' AND delivery_id IS NULL RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(400).json({ error: 'Order already accepted by another delivery or not available' });
    }
    res.json(orderRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/delivery/orders', authMiddleware(['delivery']), async (req: any, res) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, s.name as store_name, u.name as consumer_name,
       json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity)) as items
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.consumer_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.delivery_id = $1
       GROUP BY o.id, s.name, u.name`,
      [req.user.id]
    );
    res.json(ordersRes.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/delivery/orders/:id/status', authMiddleware(['delivery']), async (req: any, res) => {
  const { status } = req.body; // e.g. waiting_for_deliver, delivered
  try {
    let updateQuery = '';
    let params: any[] = [];
    if (status === 'waiting_for_deliver') {
      updateQuery = 'UPDATE orders SET status = $1, delivery_id = NULL WHERE id = $2 AND delivery_id = $3 RETURNING *';
      params = [status, req.params.id, req.user.id];
    } else {
      updateQuery = 'UPDATE orders SET status = $1 WHERE id = $2 AND delivery_id = $3 RETURNING *';
      params = [status, req.params.id, req.user.id];
    }
    const orderRes = await pool.query(updateQuery, params);
    if (orderRes.rows.length === 0) return res.status(400).json({ error: 'Could not update order status' });
    res.json(orderRes.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
