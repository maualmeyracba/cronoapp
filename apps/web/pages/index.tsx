import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase-client.service';
import { LoginForm } from '@/components/admin/login-form';

const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Obtenemos el rol real del token
          const tokenResult = await user.getIdTokenResult();
          const role = tokenResult.claims.role as string;
          
          console.log("Usuario detectado:", user.email, "| Rol:", role);

          // 🛑 LÓGICA DE BIFURCACIÓN
          if (ADMIN_ROLES.includes(role)) {
            console.log("--> Redirigiendo a Admin Dashboard");
            router.push('/admin/dashboard');
          } else {
            // Si no es admin, asumimos que es empleado (o 'employee')
            console.log("--> Redirigiendo a Employee Dashboard");
            router.push('/employee/dashboard');
          }
        } catch (e) {
          console.error("Error leyendo rol:", e);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 font-sans">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}



