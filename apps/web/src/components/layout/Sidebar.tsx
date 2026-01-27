import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Map as MapIcon, 
  Settings, 
  LogOut,
  UserCheck,
  ClipboardList,
  Wallet
} from 'lucide-react';

export function Sidebar() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Personal', href: '/admin/personal', icon: Users },
    { name: 'Asignaciones', href: '/admin/asignaciones', icon: Calendar },
    { name: 'Mapa Operativo', href: '/admin/operations/map', icon: MapIcon },
    { name: 'Liquidaciones', href: '/admin/liquidaciones', icon: Wallet },
    { name: 'Configuración', href: '/admin/configuracion', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-800">CronoApp</h1>
        <p className="text-xs text-slate-500">Panel de Control</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = router.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center mb-4 px-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.displayName || 'Administrador'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
