import { ReactNode } from 'react';

// Definición de tipos para el menú
export interface MenuItem {
  name: string;
  path?: string; // Opcional si es un padre agrupador
  icon: string;
  children?: MenuItem[]; // Soporte para submenús
}

export const APP_INFO = {
  name: 'BacarPlan',
  version: '1.3.0',
  description: 'Sistema Integral de Gestión Operativa',
  menuItems: [
    { 
      name: 'Planificación', 
      icon: 'CalendarDays',
      children: [
        { name: 'Calendario (Grid)', path: '/admin/dashboard', icon: 'LayoutDashboard' },
        { name: 'Cronograma (Gantt)', path: '/admin/planning/gantt', icon: 'Zap' },
      ]
    },
    { 
      name: 'Operaciones', 
      icon: 'Map',
      children: [
        { name: 'Torre de Control', path: '/admin/operations/map', icon: 'Map' },
      ]
    },
    { 
      name: 'Gestión', 
      icon: 'Building2',
      children: [
        { name: 'Empresas / Clientes', path: '/admin/clients', icon: 'Building2' },
        { name: 'Sedes / Objetivos', path: '/admin/objective-management', icon: 'Target' },
        { name: 'Personal / RRHH', path: '/admin/employees', icon: 'Users' },
        // 🛑 NUEVO ÍTEM
        { name: 'Convenios / Reglas', path: '/admin/labor-agreements', icon: 'Briefcase' },
        { name: 'Novedades (Licencias)', path: '/admin/rrhh/novedades', icon: 'FileText' },
      ]
    },
    { 
      name: 'Configuración', 
      icon: 'Settings',
      children: [
        { name: 'Usuarios Sistema', path: '/admin/system-users', icon: 'ShieldCheck' },
        { name: 'Diagnóstico', path: '/admin/status', icon: 'Activity' },
      ]
    },
  ] as MenuItem[]
};



