'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  price?: number;
  quantity: number;
}

interface Order {
  id: string;
  store_name: string;
  status: 'waiting_for_deliver' | 'in_progress' | 'delivered';
  created_at: string;
  items: OrderItem[];
}

export default function MyOrders() {
  const { token, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
      return;
    }

    if (token) {
      fetch('http://localhost:3001/api/consumer/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Error al cargar órdenes');
          return res.json();
        })
        .then((data) => setOrders(data))
        .catch((err) => console.error(err))
        .finally(() => setFetching(false));
    }
  }, [token, loading, router]);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'waiting_for_deliver':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            Esperando repartidor
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            En camino
          </span>
        );
      case 'delivered':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            Entregada
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando sesión...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/client"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 inline-flex items-center"
          >
            &larr; Volver al Catálogo de Tiendas
          </Link>
          <button
            onClick={() => {
              if (token) {
                setFetching(true);
                fetch('http://localhost:3001/api/consumer/orders', {
                  headers: { Authorization: `Bearer ${token}` }
                })
                  .then((res) => res.json())
                  .then((data) => setOrders(data))
                  .finally(() => setFetching(false));
              }
            }}
            className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 text-gray-700 shadow-sm"
          >
            Actualizar lista
          </button>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Mis Órdenes Realizadas</h1>
        <p className="text-sm text-gray-500 mb-6">
          Consulta en tiempo real el estado y detalle de los pedidos solicitados.
        </p>

        {fetching ? (
          <div className="text-center py-12 text-gray-500">Cargando tus órdenes...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
            <h3 className="mt-2 text-lg font-medium text-gray-900">Aún no has realizado ninguna orden</h3>
            <p className="mt-1 text-sm text-gray-500 mb-6">
              Explora las tiendas disponibles y realiza tu primer pedido.
            </p>
            <Link
              href="/client"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Ver Tiendas Abiertas
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderTotal = order.items?.reduce(
                (sum, item) => sum + (item.price ? item.price * item.quantity : 0),
                0
              );
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 gap-2">
                    <div>
                      <span className="text-xs font-mono text-gray-400">Orden ID: {order.id.slice(0, 8)}...</span>
                      <h2 className="text-xl font-bold text-gray-900 mt-0.5">{order.store_name}</h2>
                      <span className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Productos solicitados:
                    </h3>
                    <ul className="divide-y divide-gray-100 bg-gray-50 rounded-lg p-3">
                      {order.items?.map((item, idx) => (
                        <li key={idx} className="py-1.5 flex justify-between text-sm">
                          <span className="font-medium text-gray-800">
                            {item.product_name} <span className="text-gray-500">x{item.quantity}</span>
                          </span>
                          {item.price !== undefined && (
                            <span className="text-gray-600 font-mono">
                              ${(item.price * item.quantity).toLocaleString()} COP
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {orderTotal !== undefined && orderTotal > 0 && (
                      <div className="mt-3 flex justify-end items-center text-base font-bold text-gray-900">
                        Total de la orden: &nbsp;
                        <span className="text-green-700">${orderTotal.toLocaleString()} COP</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
