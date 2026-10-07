'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'consumer' | 'store' | 'delivery'>('consumer');
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (role === 'store' && !storeName.trim()) {
      setError('El nombre de la tienda es obligatorio para el rol Administrador de Tienda.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          storeName: role === 'store' ? storeName.trim() : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess('¡Registro exitoso! Redirigiendo al inicio de sesión...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        setError(data.error || 'Ocurrió un error al registrar el usuario');
      }
    } catch (err) {
      setError('Error al comunicarse con el servidor');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Crear Cuenta
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Regístrate como Cliente, Tienda o Domiciliario
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Juan Pérez"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="juan@correo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Rol
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white"
            >
              <option value="consumer">Cliente (consumer)</option>
              <option value="store">Administrador de Tienda (store)</option>
              <option value="delivery">Domiciliario (delivery)</option>
            </select>
          </div>

          {role === 'store' && (
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <label className="block text-sm font-semibold text-amber-900 mb-1">
                Nombre de la Tienda *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required={role === 'store'}
                placeholder="Pizzería Bella Italia"
                className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-amber-700 mt-1">
                La tienda se creará automáticamente asociada a tu usuario.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Crear Cuenta'}
            </button>
          </div>

          <div className="text-center text-sm pt-2">
            <span className="text-gray-600">¿Ya tienes una cuenta? </span>
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Iniciar Sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
