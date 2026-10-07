'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  price?: number;
  quantity: number;
}

interface DeliveryOrder {
  id: string;
  client_id: string;
  delivery_id: string | null;
  store_id: string;
  status: 'waiting_for_deliver' | 'in_progress' | 'delivered';
  created_at: string;
  store_name: string;
  client_name: string;
  items: OrderItem[];
}

export default function DeliveryDashboard() {
  const { user, token, loading, logout } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [myOrders, setMyOrders] = useState<DeliveryOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<DeliveryOrder | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'delivery') {
      if (user.role === 'consumer') router.push('/client');
      if (user.role === 'store') router.push('/store-admin');
      return;
    }

    if (token) {
      fetchOrders();
    }
  }, [token, user, loading, router]);

  const fetchOrders = async () => {
    setFetching(true);
    setActionError(null);
    try {
      const [availRes, myRes] = await Promise.all([
        fetch('http://localhost:3001/api/delivery/available-orders', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/delivery/orders', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (availRes.ok) setAvailableOrders(await availRes.json());
      if (myRes.ok) setMyOrders(await myRes.json());
    } catch (err) {
      console.error(err);
      setActionError('Error de red al consultar órdenes para entrega');
    } finally {
      setFetching(false);
    }
  };

  const acceptOrder = async (orderId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`http://localhost:3001/api/delivery/orders/${orderId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('¡Orden aceptada con éxito! Ahora se encuentra en tu historial activo.');
        setSelectedOrderDetail(null);
        fetchOrders();
      } else {
        // REQUERIMIENTO DEL PDF: Mostrar error en pantalla si ya fue aceptada por otro domiciliario
        setActionError(data.error || 'La orden ya fue aceptada por otro domiciliario.');
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de conexión al intentar aceptar la orden');
    }
  };

  const updateStatus = async (orderId: string, status: 'waiting_for_deliver' | 'delivered') => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`http://localhost:3001/api/delivery/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        if (status === 'waiting_for_deliver') {
          setActionSuccess('Orden soltada. Ha regresado a estado waiting_for_deliver para otros domiciliarios.');
        } else {
          setActionSuccess('¡Orden entregada con éxito! Registrada en tu historial.');
        }
        fetchOrders();
      } else {
        setActionError(data.error || 'No se pudo actualizar el estado de la orden');
      }
    } catch (err) {
      console.error(err);
      setActionError('Error al actualizar estado en el servidor');
    }
  };

  const getStatusBadge = (status: DeliveryOrder['status']) => {
    switch (status) {
      case 'waiting_for_deliver':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            ⏳ Disponible (waiting_for_deliver)
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            🛵 En Progreso (in_progress)
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            ✅ Entregada (delivered)
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando sesión...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Panel de Domiciliario</h1>
            <p className="text-sm text-gray-500 mt-1">
              Domiciliario: <strong className="text-gray-700">{user?.name}</strong> &bull; ({user?.email})
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchOrders}
              disabled={fetching}
              className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
            >
              🔄 Actualizar Órdenes
            </button>
            <button
              onClick={logout}
              className="px-4 py-2.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Notificaciones y Errores Requeridos */}
        {actionError && (
          <div className="p-4 rounded-lg bg-red-50 border-l-4 border-red-500 text-red-800 text-sm flex items-center justify-between">
            <div>
              <span className="font-bold">❌ Error en la orden:</span> {actionError}
            </div>
            <button onClick={() => setActionError(null)} className="text-red-500 font-bold ml-4">
              &times;
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 rounded-lg bg-green-50 border-l-4 border-green-500 text-green-800 text-sm flex items-center justify-between">
            <div>
              <span className="font-bold">✔️ Éxito:</span> {actionSuccess}
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-green-500 font-bold ml-4">
              &times;
            </button>
          </div>
        )}

        {/* Modal de Detalle de Orden */}
        {selectedOrderDetail && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Detalle de la Orden</h3>
                  <p className="text-xs text-gray-500 font-mono">ID: {selectedOrderDetail.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <strong>Tienda de recolección:</strong> {selectedOrderDetail.store_name}
                </p>
                <p>
                  <strong>Cliente destinatario:</strong> {selectedOrderDetail.client_name}
                </p>
                <p>
                  <strong>Fecha de creación:</strong> {new Date(selectedOrderDetail.created_at).toLocaleString()}
                </p>
                <div>
                  <strong>Productos a entregar:</strong>
                  <ul className="mt-1 bg-gray-50 p-2 rounded divide-y divide-gray-200">
                    {selectedOrderDetail.items?.map((it, idx) => (
                      <li key={idx} className="py-1 flex justify-between">
                        <span>
                          {it.product_name} x{it.quantity}
                        </span>
                        {it.price !== undefined && (
                          <span className="font-mono text-gray-600">
                            ${(it.price * it.quantity).toLocaleString()} COP
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t flex space-x-3">
                <button
                  onClick={() => acceptOrder(selectedOrderDetail.id)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition"
                >
                  Aceptar y Tomar Orden
                </button>
                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2 Secciones Principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 1. Órdenes Disponibles para Entrega */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-between">
              <span>📍 Órdenes Disponibles para Entrega</span>
              <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {availableOrders.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Órdenes con estado <em>waiting_for_deliver</em> que no han sido tomadas por ningún domiciliario.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4">
              {availableOrders.map((order) => {
                const total = order.items?.reduce(
                  (sum, item) => sum + (item.price ? item.price * item.quantity : 0),
                  0
                );
                return (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white hover:border-blue-300 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900">{order.store_name}</h4>
                        <p className="text-xs text-gray-600">Cliente: {order.client_name}</p>
                        <span className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div>{getStatusBadge(order.status)}</div>
                    </div>

                    <div className="text-xs text-gray-700 bg-white rounded p-2 my-2 border border-gray-100">
                      {order.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between py-0.5">
                          <span>
                            {it.product_name} x{it.quantity}
                          </span>
                        </div>
                      ))}
                      {total !== undefined && total > 0 && (
                        <div className="pt-1 mt-1 border-t text-right font-bold text-green-700">
                          Total: ${total.toLocaleString()} COP
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => setSelectedOrderDetail(order)}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                      >
                        👁️ Ver Detalle
                      </button>
                      <button
                        onClick={() => acceptOrder(order.id)}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Aceptar Orden
                      </button>
                    </div>
                  </div>
                );
              })}

              {availableOrders.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  No hay órdenes disponibles para entrega en este momento.
                </div>
              )}
            </div>
          </div>

          {/* 2. Historial y Órdenes Aceptadas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-between">
              <span>🛵 Mis Órdenes (Historial y Estado)</span>
              <span className="text-xs font-normal bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">
                {myOrders.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Órdenes asignadas a ti. Puedes soltar la orden o confirmarla como entregada.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4">
              {myOrders.map((order) => {
                const isInProgress = order.status === 'in_progress';
                return (
                  <div
                    key={order.id}
                    className={`border rounded-xl p-4 transition ${
                      isInProgress
                        ? 'border-blue-300 bg-blue-50/30'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900">{order.store_name}</h4>
                        <p className="text-xs text-gray-600">Cliente: {order.client_name}</p>
                        <span className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div>{getStatusBadge(order.status)}</div>
                    </div>

                    <div className="text-xs text-gray-700 bg-white rounded p-2 my-2 border border-gray-100">
                      {order.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between py-0.5">
                          <span>
                            {it.product_name} x{it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Acciones para órdenes in_progress */}
                    {isInProgress && (
                      <div className="flex space-x-2 mt-3 pt-2 border-t border-gray-200">
                        {/* Soltar o rechazar la orden: regresa a waiting_for_deliver */}
                        <button
                          onClick={() => updateStatus(order.id, 'waiting_for_deliver')}
                          className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          ↩️ Soltar / Rechazar
                        </button>
                        {/* Entregar orden: pasa a delivered */}
                        <button
                          onClick={() => updateStatus(order.id, 'delivered')}
                          className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          ✅ Marcar Entregada
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {myOrders.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  Aún no has aceptado ninguna orden de entrega.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
