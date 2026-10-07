'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  price: number;
  store_id: string;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  price?: number;
  quantity: number;
}

interface StoreOrder {
  id: string;
  client_name: string;
  status: 'waiting_for_deliver' | 'in_progress' | 'delivered';
  created_at: string;
  items: OrderItem[];
}

interface Store {
  id: string;
  name: string;
  is_open: boolean;
}

export default function StoreAdmin() {
  const { user, token, loading, logout } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'store') {
      if (user.role === 'consumer') router.push('/client');
      if (user.role === 'delivery') router.push('/delivery');
      return;
    }

    if (token) {
      fetchData();
    }
  }, [token, user, loading, router]);

  const fetchData = async () => {
    try {
      const [storeRes, productsRes, ordersRes] = await Promise.all([
        fetch('http://localhost:3001/api/store/info', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/store/products', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/store/orders', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (storeRes.ok) setStore(await storeRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al sincronizar datos de la tienda');
    }
  };

  const toggleStore = async () => {
    setIsToggling(true);
    setErrorMsg(null);
    try {
      const res = await fetch('http://localhost:3001/api/store/toggle', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setStore(updated);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'No se pudo alternar el estado de la tienda');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al conectar con el servidor');
    } finally {
      setIsToggling(false);
    }
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    const priceNum = Number(newProductPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Ingrese un precio válido');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('http://localhost:3001/api/store/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProductName.trim(), price: priceNum })
      });
      if (res.ok) {
        setNewProductName('');
        setNewProductPrice('');
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'No se pudo crear el producto');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de conexión al crear el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditPrice(p.price.toString());
  };

  const saveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim()) return;
    const priceNum = Number(editPrice);

    try {
      const res = await fetch(`http://localhost:3001/api/store/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          price: !isNaN(priceNum) ? priceNum : undefined
        })
      });
      if (res.ok) {
        setEditingProduct(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'No se pudo actualizar el producto');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al actualizar el producto');
    }
  };

  const getStatusBadge = (status: StoreOrder['status']) => {
    switch (status) {
      case 'waiting_for_deliver':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            Esperando repartidor
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            En reparto
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            Entregada
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando sesión...</div>;
  }

  if (!store) {
    return <div className="p-8 text-center text-gray-600">Cargando información de la tienda...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header de la Tienda */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-extrabold text-gray-900">{store.name}</h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  store.is_open ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {store.is_open ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Administrador: {user?.name} &bull; ID: {store.id.slice(0, 8)}...
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={toggleStore}
              disabled={isToggling}
              className={`px-5 py-2.5 rounded-lg font-bold text-white shadow transition text-sm ${
                store.is_open
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-green-600 hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {isToggling
                ? 'Actualizando...'
                : store.is_open
                ? 'Cerrar tienda'
                : 'Abrir tienda'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {errorMsg}
          </div>
        )}

        {/* 2 Columnas: Gestión de Productos y Órdenes de la Tienda */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna 1: Productos de la Tienda */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span>Productos de la tienda</span>
              <span className="text-xs font-normal text-gray-500">{products.length} producto(s)</span>
            </h2>

            {/* Formulario Crear Producto */}
            <form onSubmit={createProduct} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-700">Agregar Nuevo Producto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Nombre (ej. Pizza Margarita)"
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  placeholder="Precio en COP (ej. 25000)"
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Crear producto'}
              </button>
            </form>

            {/* Modal/Formulario de edición rápida si se selecciona un producto */}
            {editingProduct && (
              <form onSubmit={saveProductEdit} className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-blue-900">Editar Producto</h3>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="px-3 py-2 border border-blue-300 rounded-md text-sm text-gray-900 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                    className="px-3 py-2 border border-blue-300 rounded-md text-sm text-gray-900 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm transition"
                >
                  Guardar Cambios
                </button>
              </form>
            )}

            {/* Listado de Productos */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <span className="font-semibold text-gray-900 block">{prod.name}</span>
                    <span className="text-xs text-gray-500 font-mono">
                      ${Number(prod.price).toLocaleString()} COP
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditProduct(prod)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded transition"
                  >
                    Editar
                  </button>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">
                  No hay productos registrados en tu tienda. Agrega uno arriba.
                </p>
              )}
            </div>
          </div>

          {/* Columna 2: Órdenes de la Tienda */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span>Órdenes de la tienda</span>
              <span className="text-xs font-normal text-gray-500">{orders.length} orden(es)</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4">
              {orders.map((ord) => {
                const total = ord.items?.reduce(
                  (sum, item) => sum + (item.price ? item.price * item.quantity : 0),
                  0
                );
                return (
                  <div key={ord.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-mono text-gray-400">ID: {ord.id.slice(0, 8)}...</span>
                        <h4 className="text-sm font-bold text-gray-900">
                          Cliente: {ord.client_name || 'Consumidor'}
                        </h4>
                        <span className="text-xs text-gray-400">
                          {new Date(ord.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div>{getStatusBadge(ord.status)}</div>
                    </div>

                    <ul className="divide-y divide-gray-200 text-xs text-gray-700 bg-white rounded p-2 my-2">
                      {ord.items?.map((it, i) => (
                        <li key={i} className="py-1 flex justify-between">
                          <span>
                            {it.product_name} x{it.quantity}
                          </span>
                          {it.price !== undefined && (
                            <span className="font-mono text-gray-500">
                              ${(it.price * it.quantity).toLocaleString()} COP
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {total !== undefined && total > 0 && (
                      <div className="text-right text-xs font-bold text-gray-800">
                        Total: <span className="text-green-700 font-mono">${total.toLocaleString()} COP</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {orders.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">
                  No hay órdenes recibidas todavía para tu tienda.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
