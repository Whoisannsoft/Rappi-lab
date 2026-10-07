'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Store {
  id: string;
  name: string;
  is_open: boolean;
}

export default function ClientDashboard() {
  const { user, token, loading, logout } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'consumer') {
      if (user.role === 'store') router.push('/store-admin');
      if (user.role === 'delivery') router.push('/delivery');
      return;
    }

    if (token) {
      fetch('http://localhost:3001/api/stores', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Error al cargar tiendas');
          return res.json();
        })
        .then((data) => setStores(data))
        .catch((err) => console.error(err))
        .finally(() => setFetching(false));
    }
  }, [token, user, loading, router]);

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando sesión...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portal de Clientes</h1>
            <p className="text-sm text-gray-500">Bienvenido, {user?.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/client/orders"
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium text-sm transition"
            >
              🛍️ Mis Órdenes
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium text-sm transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Tiendas Disponibles</h2>
          <p className="text-sm text-gray-500">
            Solo se muestran tiendas abiertas actualmente para recibir pedidos.
          </p>
        </div>

        {fetching ? (
          <div className="text-center py-12 text-gray-500">Cargando tiendas abiertas...</div>
        ) : stores.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
            <span className="text-4xl">🏪</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No hay tiendas abiertas en este momento</h3>
            <p className="mt-1 text-sm text-gray-500">
              Vuelve a revisar más tarde cuando los administradores abran sus tiendas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div
                key={store.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{store.name}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Abierta
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Lista para preparar tu orden. Haz clic abajo para ver el menú de productos.
                  </p>
                </div>
                <Link
                  href={`/client/stores/${store.id}`}
                  className="w-full text-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition block"
                >
                  Ver Productos y Ordenar &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
