import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:12345@localhost:5432/delivery_db'
});

export const initDB = async () => {
  const client = await pool.connect();
  try {
    // Check if users table exists and if id is integer instead of uuid
    const checkTable = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    `);

    if (checkTable.rows.length > 0 && checkTable.rows[0].data_type !== 'uuid') {
      console.log('Migrating tables from legacy integer schema to required UUID schema...');
      await client.query(`
        DROP TABLE IF EXISTS order_items CASCADE;
        DROP TABLE IF EXISTS orders CASCADE;
        DROP TABLE IF EXISTS products CASCADE;
        DROP TABLE IF EXISTS stores CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        DROP TYPE IF EXISTS order_status CASCADE;
      `);
    }

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('consumer', 'store', 'delivery'))
      );

      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        is_open BOOLEAN NOT NULL DEFAULT false,
        user_owner_id UUID REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delivery_id UUID REFERENCES users(id) ON DELETE SET NULL,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'waiting_for_deliver' CHECK (status IN ('waiting_for_deliver', 'in_progress', 'delivered')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );
    `);
    console.log("Database initialized successfully according to Lab 4 ER diagram");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
