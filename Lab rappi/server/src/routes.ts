import { Router } from 'express';
import { AuthController } from './controllers/auth.controller';
import { StoreController } from './controllers/store.controller';
import { OrderController } from './controllers/order.controller';
import { DeliveryController } from './controllers/delivery.controller';
import { authMiddleware } from './middleware';

const router = Router();

// ==========================================
// 1. Rutas de Autenticación (Públicas)
// ==========================================
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);

// ==========================================
// 2. Rutas de Cliente (consumer)
// ==========================================
// Pantalla 1: Ver tiendas abiertas
router.get('/stores', authMiddleware(['consumer']), StoreController.getOpenStores);
// Pantalla 2: Ver información de una tienda y sus productos
router.get('/stores/:id', authMiddleware(['consumer']), StoreController.getStoreById);
router.get('/stores/:id/products', authMiddleware(['consumer']), StoreController.getProductsByStore);
// Pantalla 2: Crear orden (con validación de tienda abierta en la capa de Service)
router.post('/orders', authMiddleware(['consumer']), OrderController.createOrder);
// Pantalla 3: Consultar órdenes realizadas y su estado
router.get('/consumer/orders', authMiddleware(['consumer']), OrderController.getClientOrders);

// ==========================================
// 3. Rutas de Administrador de Tienda (store)
// ==========================================
// Ver información de la tienda
router.get('/store/info', authMiddleware(['store']), StoreController.getMyStore);
// Alternar estado Abierta/Cerrada (is_open)
router.put('/store/toggle', authMiddleware(['store']), StoreController.toggleStore);
// Productos: Listar, Crear y Actualizar
router.get('/store/products', authMiddleware(['store']), StoreController.getMyProducts);
router.post('/store/products', authMiddleware(['store']), StoreController.createProduct);
router.put('/store/products/:id', authMiddleware(['store']), StoreController.updateProduct);
// Ver órdenes asociadas a dicha tienda
router.get('/store/orders', authMiddleware(['store']), OrderController.getStoreOrders);

// ==========================================
// 4. Rutas de Domiciliario (delivery)
// ==========================================
// Ver lista de órdenes disponibles (waiting_for_deliver y sin tomar)
router.get('/delivery/available-orders', authMiddleware(['delivery']), DeliveryController.getAvailableOrders);
// Aceptar orden
router.put('/delivery/orders/:id/accept', authMiddleware(['delivery']), DeliveryController.acceptOrder);
// Actualizar estado de orden (soltar orden -> 'waiting_for_deliver', entregar -> 'delivered')
router.put('/delivery/orders/:id/status', authMiddleware(['delivery']), DeliveryController.updateOrderStatus);
// Ver historial y órdenes aceptadas
router.get('/delivery/orders', authMiddleware(['delivery']), DeliveryController.getMyDeliveryOrders);

export default router;
