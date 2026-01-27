import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase-client.service'; 

// Roles administrativos globales (para referencia)
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];

/**
 * Higher-Order Component para proteger rutas.
 * @param WrappedComponent El componente de página a proteger.
 * @param requiredRoles Un solo rol (string) o un array de roles permitidos (string[]).
 */
export const withAuthGuard = (
    WrappedComponent: React.ComponentType<any>, 
    requiredRoles: string | string[] = ['admin'] // 🛑 FIX: Acepta string o array
) => {
  
  // Normalizamos a array para facilitar la lógica
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  console.log(`[DEBUG GUARD] Roles Requeridos:`, rolesArray);

  const ComponentWithAuthGuard = (props: any) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace('/'); 
          return;
        }

        setCurrentUser(user);
        
        try {
          // Forzamos refresh del token para tener los claims actualizados
          const tokenResult = await user.getIdTokenResult(true);
          const userRole = tokenResult.claims.role as string;
          
          console.log(`[DEBUG GUARD] Usuario: ${user.email} | Rol: ${userRole}`);

          // 🛑 LÓGICA DE AUTORIZACIÓN CORREGIDA
          // Verificamos si el rol del usuario está incluido en los roles permitidos
          const isAuthorized = rolesArray.includes(userRole);

          if (isAuthorized) {
            setLoading(false);
          } else {
            console.warn(`⛔ [GUARD] Acceso Denegado. Rol '${userRole}' no autorizado.`);
            router.replace('/'); 
          }
        } catch (error) {
          console.error("❌ [GUARD] Error validando rol:", error);
          router.replace('/');
        }
      });

      return () => unsubscribe();
    }, [router]);

    if (loading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-500 font-medium animate-pulse">Verificando permisos...</p>
        </div>
      );
    }

    return <WrappedComponent {...props} currentUser={currentUser} />;
  };

  return ComponentWithAuthGuard;
};



