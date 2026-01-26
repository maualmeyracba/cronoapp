
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

export default function IndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // 1. Si Auth ya respondió, decidimos rápido
    if (!loading) {
      if (user) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/login');
      }
    }

    // 2. TIMEOUT DE SEGURIDAD (La clave para arreglar localhost)
    // Si el AuthContext se tarda, forzamos la ida al login a los 1000ms.
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth tardó mucho, redirigiendo a Login por seguridad...");
        router.replace('/login');
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [user, loading, router]);

  // Spinner simple mientras redirige
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-slate-500 text-xs font-bold animate-pulse">Iniciando...</p>
      </div>
    </div>
  );
}
