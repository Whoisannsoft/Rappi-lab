import { Request, Response } from 'express';
import { StoreService } from '../services/store.service';

export class StoreController {
  // Consumer: Listar tiendas abiertas
  static async getOpenStores(req: Request, res: Response) {
    try {
      const stores = await StoreService.getOpenStores();
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Consumer: Ver detalle de una tienda
  static async getStoreById(req: Request, res: Response) {
    try {
      const storeId = req.params.id as string;
      const store = await StoreService.getStoreById(storeId);
      if (!store) {
        return res.status(404).json({ error: 'Tienda no encontrada' });
      }
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Consumer / Store: Listar productos de una tienda
  static async getProductsByStore(req: Request, res: Response) {
    try {
      const storeId = req.params.id as string;
      const products = await StoreService.getProductsByStore(storeId);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Store: Ver información de su tienda
  static async getMyStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const store = await StoreService.getStoreByOwner(userId);
      if (!store) {
        return res.status(404).json({ error: 'Tienda no encontrada para este usuario' });
      }
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Store: Alternar estado Abierta/Cerrada
  static async toggleStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const store = await StoreService.toggleStoreStatus(userId);
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Store: Crear producto
  static async createProduct(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, price } = req.body;
      const product = await StoreService.createProduct(userId, name, Number(price));
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Store: Actualizar nombre del producto
  static async updateProduct(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const productId = req.params.id as string;
      const { name, price } = req.body;
      const product = await StoreService.updateProduct(userId, productId, name, price !== undefined ? Number(price) : undefined);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Store: Listar mis productos
  static async getMyProducts(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const products = await StoreService.getMyStoreProducts(userId);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
