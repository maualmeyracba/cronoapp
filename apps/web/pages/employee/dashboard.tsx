// Archivo: apps/web/pages/employee/dashboard.tsx

import React from 'react';
import { useRouter } from 'next/router';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import { EmployeeDashboard } from '@/components/employee/employee-dashboard';
import { auth } from '@/services/firebase-client.service';

// 🛑 FIX: NO usamos DashboardLayout aquí para evitar el sidebar de admin
// Si quieres un layout, deberíamos crear uno específico para empleados.
// Por ahora, usamos un div simple para limpiar la vista.

function EmployeePage({ currentUser }: { currentUser: any }) {
  const router = useRouter(); 
  
  const handleLogout = async () => {
      await auth.signOut();
      window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header Simple para Empleado */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
                {/* Logo simple */}
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div>
                <h1 className="text-lg font-bold text-gray-800 leading-none">Mi Portal</h1>
                <p className="text-xs text-gray-500">{currentUser?.email}</p>
            </div>
        </div>
        
        <button onClick={handleLogout} className="text-sm text-red-600 font-medium border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            Salir
        </button>
      </header>

      {/* Renderizamos el componente de tarjetas nuevo */}
      <main className="p-4">
        <EmployeeDashboard currentUser={currentUser} />
      </main>
    </div>
  );
}

export default withAuthGuard(EmployeePage, ['employee']);



