import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import { useAuth } from '@/context/AuthContext';
import { Calendar, LogOut, User } from 'lucide-react';

function EmployeeHome() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header Simple para Móvil */}
            <header className="bg-indigo-900 text-white p-4 shadow-md flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-700 rounded-full flex items-center justify-center font-bold">
                        {user?.displayName?.charAt(0) || 'E'}
                    </div>
                    <div>
                        <h1 className="font-bold text-sm">{user?.displayName || 'Colaborador'}</h1>
                        <p className="text-[10px] text-indigo-200 uppercase">Portal del Empleado</p>
                    </div>
                </div>
                <button onClick={logout} className="p-2 bg-indigo-800 rounded-lg hover:bg-indigo-700">
                    <LogOut size={18}/>
                </button>
            </header>

            {/* Contenido */}
            <main className="p-4 space-y-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                        <Calendar size={32}/>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Mi Cronograma</h2>
                    <p className="text-gray-500 text-sm mb-4">Consulta tus turnos asignados.</p>
                    <button className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition">
                        Ver Turnos
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <User size={32}/>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Mis Datos</h2>
                    <p className="text-gray-500 text-sm mb-4">Información personal y legajo.</p>
                    <button className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">
                        Ver Perfil
                    </button>
                </div>
            </main>
        </div>
    );
}

// 🛑 SEGURIDAD: Esta página permite SOLO a 'employee' (y admins si quieren verla)
export default withAuthGuard(EmployeeHome, ['employee', 'admin', 'SuperAdmin']);

