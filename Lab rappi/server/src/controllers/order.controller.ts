import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';

export class OrderController {
  // Consumer: Crear orden (con validación en Service de tienda abierta)
  static async createOrder(req: Request, res: Response) {
    try {
      const clientId = (req as any).user.id;
      const { store_id, items } = req.body;
      const orderId = await OrderService.createOrder(clientId, store_id, items);
      res.status(201).json({ id: orderId, message: 'Orden creada exitosamente' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Consumer: Listar mis órdenes
  static async getClientOrders(req: Request, res: Response) {
    try {
      const clientId = (req as any).user.id;
      const orders = await OrderService.getOrdersByClient(clientId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Store: Listar órdenes de la tienda
  static async getStoreOrders(req: Request, res: Response) {
    try {
      const ownerId = (req as any).user.id;
      const orders = await OrderService.getOrdersByStoreOwner(ownerId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
