import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { User, UserRole } from '../types';

const SECRET_KEY = process.env.JWT_SECRET || 'supersecret123';

export class AuthService {
  static async register(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    storeName?: string;
  }) {
    const { name, email, password, role, storeName } = data;

    if (!name || !email || !password || !role) {
      throw new Error('Todos los campos requeridos deben ser completados.');
    }

    if (!['consumer', 'store', 'delivery'].includes(role)) {
      throw new Error('Rol no válido.');
    }

    if (role === 'store' && (!storeName || !storeName.trim())) {
      throw new Error('El nombre de la tienda (storeName) es obligatorio para el rol store.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new Error('El correo electrónico ya está registrado.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRes = await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
        [name, email, hashedPassword, role]
      );
      const user: User = userRes.rows[0];

      if (role === 'store') {
        await client.query(
          'INSERT INTO stores (name, user_owner_id, is_open) VALUES ($1, $2, $3)',
          [storeName!.trim(), user.id, false]
        );
      }

      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Credenciales incompletas.');
    }

    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      throw new Error('Credenciales inválidas.');
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new Error('Credenciales inválidas.');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      SECRET_KEY,
      { expiresIn: '1d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole
      }
    };
  }
}
