'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  store_id: string;
}

interface Store {
  id: string;
  name: string;
  is_open: boolean;
}

export default function StoreDetails() {
  const { id } = useParams<{ id: string }>();
  const { token, loading } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
      return;
    }

    if (token && id) {
      Promise.all([
        fetch(`http://localhost:3001/api/stores/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`http://localhost:3001/api/stores/${id}/products`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])
        .then(async ([storeRes, productsRes]) => {
          if (!storeRes.ok) {
            throw new Error('No se pudo encontrar la tienda');
          }
          const storeData = await storeRes.json();
          const productsData = await productsRes.json();
          setStore(storeData);
          setProducts(productsData);
        })
        .catch((err) => {
          console.error(err);
          setErrorMsg(err.message || 'Error al cargar información de la tienda');
        })
        .finally(() => setFetching(false));
    }
  }, [id, token, loading, router]);

  const handleQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((sum, [prodId, qty]) => {
    const prod = products.find((p) => p.id === prodId);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const createOrder = async () => {
    // Validación estricta en frontend
    if (!store || !store.is_open) {
      alert('La tienda está cerrada. No se pueden crear órdenes.');
      return;
    }

    const items = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ product_id: productId, quantity: qty }));

    if (items.length === 0) {
      alert('Seleccione al menos un producto con cantidad mayor a cero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ store_id: id, items })
      });

      const data = await res.json();
      if (res.ok) {
        alert('¡Orden creada exitosamente!');
        router.push('/client/orders');
      } else {
        setErrorMsg(data.error || 'Error al procesar la orden en el servidor');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error de conexión al enviar la orden');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return <div className="p-8 text-center text-gray-600">Cargando menú de la tienda...</div>;
  }

  if (!store) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <p className="text-red-600 mb-4">{errorMsg || 'Tienda no disponible.'}</p>
        <Link href="/client" className="text-blue-600 underline">
          &larr; Volver a tiendas
        </Link>
      </div>
    );
  }

  const isStoreClosed = !store.is_open;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/client"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mb-6"
        >
          &larr; Volver al listado de tiendas
        </Link>

        {/* Store Header Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">{store.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Selecciona los productos y las cantidades deseadas</p>
            </div>
            <div>
              {store.is_open ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                  ● Abierta para pedidos
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                  ● Tienda Cerrada
                </span>
              )}
            </div>
          </div>

          {/* Bloqueo explícito requerido en el PDF si la tienda está cerrada */}
          {isStoreClosed && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              <span className="font-bold">⚠️ Atención:</span> Esta tienda se encuentra actualmente <strong>CERRADA</strong>.
              La opción de compra ha sido bloqueada según las políticas del sistema.
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Product List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {products.map((product) => {
            const qty = cart[product.id] || 0;
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
                  <p className="text-gray-600 font-semibold mt-1">
                    ${Number(product.price).toLocaleString()} COP
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Cantidad:</span>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => handleQuantity(product.id, -1)}
                      disabled={qty === 0 || isStoreClosed}
                      className="w-8 h-8 rounded-full bg-gray-100 text-gray-800 font-bold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-gray-900">{qty}</span>
                    <button
                      type="button"
                      onClick={() => handleQuantity(product.id, 1)}
                      disabled={isStoreClosed}
                      className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-200 mb-8">
            Esta tienda aún no tiene productos registrados.
          </div>
        )}

        {/* Order Summary & Checkout Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Resumen del Pedido</div>
            <div className="text-xl font-bold text-gray-900">
              {totalItems} producto(s) &bull; Total: ${totalPrice.toLocaleString()} COP
            </div>
          </div>

          <button
            type="button"
            onClick={createOrder}
            disabled={isStoreClosed || totalItems === 0 || submitting}
            className={`px-8 py-3 rounded-lg font-bold text-white shadow transition text-base ${
              isStoreClosed || totalItems === 0 || submitting
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : 'bg-green-600 hover:bg-green-700 cursor-pointer'
            }`}
          >
            {submitting
              ? 'Procesando...'
              : isStoreClosed
              ? 'Tienda Cerrada (Compra Bloqueada)'
              : totalItems === 0
              ? 'Selecciona Productos'
              : 'Confirmar y Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  );
}
