
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '@/services/firebase-client.service'; 
import { onAuthStateChanged } from 'firebase/auth';

export function withAuthGuard<P extends object>(Component: React.ComponentType<P>, allowedRoles?: string[]) {
  return function WithAuthGuard(props: P) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      // Escuchar cambios en la autenticación
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          console.log("⛔ No autenticado (Modo desarrollo: Permitido temporalmente)");
          // router.replace('/auth/login'); // Descomentar en producción
          setAuthorized(true); 
        } else {
          setAuthorized(true);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }, [router]);

    if (loading) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!authorized) return null;

    return <Component {...props} />;
  };
}
