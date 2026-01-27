import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase-client.service';
import { useClient } from '@/context/ClientContext';
import { FileText, Plus, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function ContractsPage() {
  const { selectedClientId } = useClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts-list', selectedClientId],
    queryFn: async () => {
      const contractsRef = collection(db, 'contratos_servicio');
      const q = selectedClientId 
        ? query(contractsRef, where('clientId', '==', selectedClientId))
        : contractsRef;
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  });

  return (
    <DashboardLayout title="Convenios y Contratos">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {contracts.length} Contratos encontrados
          </p>
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-200">
            <Plus size={16} /> Nuevo Convenio
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={40}/></div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-20 border-2 border-dashed border-slate-200 text-center">
            <AlertCircle size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-xs">No hay convenios cargados para esta selección</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contracts.map((c: any) => (
              <div key={c.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><FileText size={20}/></div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${c.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase mb-1">{c.name || 'Contrato sin nombre'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{c.objectiveName || 'Sin objetivo asignado'}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-300" />
                    <span className="text-xs font-black text-slate-700">{c.totalHoursPerMonth || 0}hs <small className="text-slate-400">/mes</small></span>
                  </div>
                  <CheckCircle2 size={16} className="text-indigo-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}