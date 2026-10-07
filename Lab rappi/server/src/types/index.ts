export type UserRole = 'consumer' | 'store' | 'delivery';
export type OrderStatus = 'waiting_for_deliver' | 'in_progress' | 'delivered';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
}

export interface Store {
  id: string;
  name: string;
  is_open: boolean;
  user_owner_id: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  store_id: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  product_name?: string;
  price?: number;
}

export interface Order {
  id: string;
  client_id: string;
  delivery_id: string | null;
  store_id: string;
  status: OrderStatus;
  created_at: string;
  store_name?: string;
  client_name?: string;
  items?: OrderItem[];
}
