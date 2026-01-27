import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuditLogs } from '@/hooks/useAudit';
import { Shield, Clock, User, Activity } from 'lucide-react';

export default function AuditPage() {
  const { data: logs = [], isLoading } = useAuditLogs({ limit: 50 });

  return (
    <DashboardLayout title="Auditoría de Sistema">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registros de Actividad</h2>
            <p className="text-sm text-slate-500">Historial completo de acciones realizadas en la plataforma</p>
          </div>
          <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <Shield size={14} /> {logs.length} Registros
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / Hora</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400 animate-pulse">Cargando registros de auditoría...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400">No se encontraron registros de actividad</td>
                </tr>
              ) : (
                logs.map((log: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-2"><Clock size={14} className="text-slate-300" /> {log.timestampIso || '---'}</div>
                    </td>
                    <td className="px-8 py-4 text-sm text-slate-800 font-bold">
                      <div className="flex items-center gap-2"><User size={14} className="text-indigo-400" /> {log.changedBy || 'Sistema'}</div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Activity size={14} className="text-slate-300" /> {log.module || 'General'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}