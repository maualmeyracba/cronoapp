import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useClient } from '@/context/ClientContext';
import { auth } from '@/services/firebase-client.service';
import { APP_INFO, MenuItem } from '@/config/app.config';
// Importamos iconos
import { 
  LayoutDashboard, Building2, Target, Users, CalendarDays, ShieldCheck, 
  Activity, Menu, X, LogOut, ChevronDown, Settings, Map, Zap, 
  FileText, ChevronRight 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

// Mapeo de iconos
const iconMap: any = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  Building2: <Building2 size={20} />,
  Target: <Target size={20} />,
  Users: <Users size={20} />,
  CalendarDays: <CalendarDays size={20} />,
  ShieldCheck: <ShieldCheck size={20} />,
  Activity: <Activity size={20} />,
  Map: <Map size={20} />,
  Zap: <Zap size={20} />,
  Settings: <Settings size={20} />,
  FileText: <FileText size={20} />
};

function DashboardLayout({ children, title }: LayoutProps) {
  const router = useRouter();
  const { clients, selectedClientId, setClient, loading } = useClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 🛑 ESTADO PARA CONTROLAR LOS MENÚS ABIERTOS
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // Efecto para abrir automáticamente el menú donde está la ruta actual
  useEffect(() => {
    const newOpenState = { ...openMenus };
    APP_INFO.menuItems.forEach(item => {
      if (item.children) {
        // Si alguno de los hijos es la ruta actual, abrimos el padre
        const isChildActive = item.children.some(child => child.path === router.pathname);
        if (isChildActive) {
          newOpenState[item.name] = true;
        }
      }
    });
    setOpenMenus(newOpenState);
  }, []); // Se ejecuta solo al montar

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/'; 
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // --- COMPONENTE DE RENDERIZADO DE ITEM DE MENÚ ---
  const renderMenuItem = (item: MenuItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus[item.name];
    
    // Verificamos si este item (o sus hijos) está activo
    const isActiveParent = hasChildren && item.children?.some(child => child.path === router.pathname);
    const isActive = router.pathname === item.path;

    // 1. SI TIENE HIJOS (ES UN GRUPO)
    if (hasChildren) {
      return (
        <div key={item.name} className="mb-1">
          <button
            onClick={() => toggleMenu(item.name)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
              isActiveParent 
                ? 'bg-indigo-50/50 text-indigo-700 font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className={`transition-colors ${isActiveParent ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                {iconMap[item.icon] || <Settings size={20} />}
              </span>
              <span className="text-sm">{item.name}</span>
            </div>
            {/* Flecha de rotación */}
            <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
               <ChevronRight size={16} className="text-slate-400"/>
            </div>
          </button>

          {/* Renderizado de Hijos (Submenú) */}
          {isOpen && (
            <div className="mt-1 ml-4 border-l-2 border-slate-100 space-y-1">
              {item.children!.map(child => {
                const isChildActive = router.pathname === child.path;
                return (
                  <button
                    key={child.path}
                    onClick={() => {
                      if (child.path) router.push(child.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-r-lg transition-all duration-200 ml-1 ${
                      isChildActive 
                        ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600 -ml-[5px]' // Efecto visual activo
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm ${isChildActive ? 'ml-0' : 'ml-0'}`}>{child.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 2. SI ES UN ITEM SIMPLE (SIN HIJOS)
    return (
      <button
        key={item.path}
        onClick={() => {
          if (item.path) router.push(item.path);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group mb-1 ${
          isActive 
            ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-200' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
        }`}
      >
        <span className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
          {iconMap[item.icon] || <Settings size={20} />}
        </span>
        <span className="text-sm">{item.name}</span>
      </button>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
        <div>
          <h1 className="text-xl font-extrabold text-indigo-700 tracking-tight">
            {APP_INFO.name}
          </h1>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 bg-slate-50">
                v{APP_INFO.version}
            </span>
          </div>
        </div>
      </div>

      {/* Contexto */}
      <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/50">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
            Contexto Operativo
          </label>
          {loading ? (
              <div className="h-9 w-full bg-slate-200 rounded animate-pulse"></div>
          ) : (
              <div className="relative">
                <select 
                    value={selectedClientId} 
                    onChange={(e) => setClient(e.target.value)}
                    className={`w-full text-sm border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-2 pr-8 appearance-none cursor-pointer truncate font-medium ${selectedClientId === '' ? 'bg-indigo-50 text-indigo-700 font-bold border-indigo-200' : 'bg-white text-slate-700'}`}
                >
                    <option value="">🏢 Ver Toda la Operación</option>
                    <optgroup label="Clientes Específicos">
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.businessName}</option>
                        ))}
                    </optgroup>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <ChevronDown size={14} />
                </div>
              </div>
          )}
      </div>

      {/* Navegación (Renderizado Dinámico) */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {APP_INFO.menuItems.map(item => renderMenuItem(item))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 mt-auto bg-white">
        <button onClick={handleLogout} className="flex items-center space-x-3 text-rose-600 hover:bg-rose-50 w-full px-3 py-2.5 rounded-lg transition-colors text-sm font-medium group">
          <LogOut size={20} className="group-hover:text-rose-700" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-600">
      
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-30 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 h-screen overflow-hidden transition-all duration-300">
        
        {/* Topbar */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden -ml-2 p-2 text-slate-500 hover:text-indigo-600 rounded-md">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-slate-800 truncate leading-tight">{title}</h2>
          </div>
          <div className="flex items-center space-x-4">
             <div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-100 shadow-sm">
               AD
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;



