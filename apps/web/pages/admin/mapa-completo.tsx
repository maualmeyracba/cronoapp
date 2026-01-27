import React, { useState } from 'react';

export default function AuditMap() {
  const [sel, setSel] = useState<any>(null);
  const data = [
    { n: "Core & Architecture", c: [
      { id: 1, name: "AuthContext.tsx", d: "Manejo de Firebase Auth y Custom Claims.", p: "apps/web/src/context/AuthContext.tsx" },
      { id: 2, name: "ThemeContext.tsx", d: "Infraestructura de temas dinámicos.", p: "apps/web/src/context/ThemeContext.tsx" },
      { id: 3, name: "_app.tsx", d: "Raíz de Next.js y Providers globales.", p: "apps/web/pages/_app.tsx" },
      { id: 4, name: "_document.tsx", d: "Estructura HTML base del sitio.", p: "apps/web/pages/_document.tsx" }
    ]},
    { n: "Administración", c: [
      { id: 5, name: "system-user-management.tsx", d: "Gestión de personal, roles y personalización.", p: "src/components/admin/system-user-management.tsx" },
      { id: 6, name: "dashboard.tsx", d: "Vista principal de control administrativo.", p: "pages/admin/dashboard.tsx" }
    ]},
    { n: "Componentes Atómicos", c: [
      { id: 7, name: "Button.tsx", d: "Botón estandarizado con variantes.", p: "src/components/common/Button.tsx" },
      { id: 8, name: "InputField.tsx", d: "Entrada de texto con validación.", p: "src/components/common/InputField.tsx" },
      { id: 9, name: "SelectField.tsx", d: "Selector de opciones personalizado.", p: "src/components/common/SelectField.tsx" },
      { id: 10, name: "withAuthGuard.tsx", d: "HOC de protección de rutas.", p: "src/components/common/withAuthGuard.tsx" }
    ]},
    { n: "Layout & Servicios", c: [
      { id: 11, name: "DashboardLayout.tsx", d: "Estructura envolvente del dashboard.", p: "src/components/layout/DashboardLayout.tsx" },
      { id: 12, name: "Sidebar.tsx", d: "Navegación lateral por permisos.", p: "src/components/layout/Sidebar.tsx" },
      { id: 13, name: "firebase-client.service.ts", d: "Instancia del SDK de Firebase.", p: "src/services/firebase-client.service.ts" }
    ]},
    { n: "Mantenimiento & Raíz", c: [
      { id: 14, name: "set-admin-role.js", d: "Script de asignación de rol administrador.", p: "/set-admin-role.js" },
      { id: 15, name: "set-employee-role.js", d: "Script de asignación de rol empleado.", p: "/set-employee-role.js" }
    ]}
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans flex gap-8 text-slate-900">
      <div className="w-1/3 bg-white p-8 rounded-[2.5rem] border shadow-sm h-[85vh] overflow-auto flex flex-col">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-8 italic">Audit Map Completo</h1>
        {data.map((folder, i) => (
          <div key={i} className="mb-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">{folder.n}</h4>
            <div className="space-y-1">
              {folder.c.map(file => (
                <div key={file.id} onClick={() => setSel(file)} className={"p-3 text-[11px] font-bold cursor-pointer rounded-xl transition-all " + (sel?.id === file.id ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 text-slate-600")}>
                  {file.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-white p-16 rounded-[3.5rem] border shadow-sm flex flex-col justify-center relative overflow-hidden">
        {sel ? (
          <div>
            <h2 className="text-6xl font-black uppercase tracking-tighter text-slate-900 mb-6">{sel.name}</h2>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-10 text-xs font-mono">{sel.p}</div>
            <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-white shadow-2xl">
               <p className="text-xl font-medium leading-relaxed italic">"{sel.d}"</p>
            </div>
          </div>
        ) : <p className="m-auto opacity-20 font-black uppercase text-4xl italic tracking-tighter">Selecciona un archivo</p>}
      </div>
    </div>
  );
}