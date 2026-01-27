import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase-client.service';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Colores personalizados basados en la imagen de referencia (Rojo ATM)
  const colors = {
    primary: '#a81d1d', // Rojo intenso
    primaryHover: '#8c1818',
    bgInput: '#eff4fc', // Fondo azul muy claro de los inputs
    textGray: '#6b7280',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/admin/dashboard');
    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            setError('Credenciales incorrectas. Verifique email y contraseña.');
        } else if (err.code === 'auth/too-many-requests') {
            setError('Demasiados intentos. Por favor espere unos minutos.');
        } else {
            setError('Error al iniciar sesión. Intente nuevamente.');
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tarjeta de Login con sombra suave y bordes redondeados */}
      <div className="bg-white shadow-xl rounded-3xl px-8 pt-10 pb-12 mb-4 border border-gray-50 relative overflow-hidden">
        
        {/* Logo (Placeholder textual, puedes reemplazar por una etiqueta <img> si tienes el logo en /public) */}
        <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center justify-center mb-4">
                {/* Icono/Logo Simulado en Rojo */}
                <div className="bg-red-50 p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" style={{ color: colors.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mt-4">Sistema de Gestión</h2>
            </div>
            <p className="text-sm text-gray-500">Inicia sesión para acceder al panel.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
            {/* Banner de Error Estilizado */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md animate-pulse">
                    <div className="flex items-center">
                        <svg className="h-5 w-5 text-red-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                </div>
            )}
            
            {/* Input Email con Icono */}
            <div className="mb-5 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <input
                className="appearance-none rounded-xl w-full py-4 pl-12 pr-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-200 transition duration-200 font-medium placeholder-gray-400"
                style={{ backgroundColor: colors.bgInput, border: '1px solid transparent' }}
                id="email"
                type="email"
                placeholder="admin@bacarsa.com.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Input Password con Icono */}
            <div className="mb-8 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
              </div>
              <input
                className="appearance-none rounded-xl w-full py-4 pl-12 pr-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-200 transition duration-200 font-medium placeholder-gray-400 tracking-widest"
                style={{ backgroundColor: colors.bgInput, border: '1px solid transparent' }}
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Botón Submit */}
            <button
                className={`w-full text-white font-bold py-4 px-4 rounded-xl focus:outline-none focus:shadow-outline transition duration-300 flex justify-center items-center text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: loading ? colors.primaryHover : colors.primary }}
                type="submit"
                disabled={loading}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Accediendo...
                    </>
                ) : 'Acceder al Sistema'}
            </button>
        </form>
      </div>
      
      <p className="text-center text-gray-400 text-sm mt-6 font-medium">
        Ver 3.0 Beta
      </p>
    </div>
  );
}



