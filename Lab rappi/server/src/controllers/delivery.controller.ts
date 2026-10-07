import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';

export class DeliveryController {
  // Domiciliario: Listar órdenes disponibles (sin tomar por otro, waiting_for_deliver y delivery_id IS NULL)
  static async getAvailableOrders(req: Request, res: Response) {
    try {
      const orders = await OrderService.getAvailableOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Domiciliario: Aceptar orden
  static async acceptOrder(req: Request, res: Response) {
    try {
      const deliveryId = (req as any).user.id;
      const orderId = req.params.id as string;
      const updatedOrder = await OrderService.acceptOrder(orderId, deliveryId);
      res.json({ message: 'Orden aceptada correctamente', order: updatedOrder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Domiciliario: Soltar/Rechazar orden o Marcar como entregada
  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const deliveryId = (req as any).user.id;
      const orderId = req.params.id as string;
      const { status } = req.body;
      const updatedOrder = await OrderService.updateOrderStatus(orderId, deliveryId, status);
      res.json({ message: 'Estado de la orden actualizado', order: updatedOrder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Domiciliario: Ver historial y órdenes aceptadas
  static async getMyDeliveryOrders(req: Request, res: Response) {
    try {
      const deliveryId = (req as any).user.id;
      const orders = await OrderService.getOrdersByDeliveryDriver(deliveryId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
