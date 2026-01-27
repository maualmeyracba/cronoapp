
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';
import { Layers, AlertTriangle, UserCheck, Clock, Siren, Shield, Calendar } from 'lucide-react';

const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { loading: () => <div className="h-screen flex items-center justify-center text-slate-400 bg-slate-900">Cargando Mapa Táctico...</div>, ssr: false });

export default function TacticalMapView() {
    const logic = useOperacionesMonitor();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-900 text-white overflow-hidden">
            <Head><title>COSP TACTICAL MAP</title></Head>
            <style>{POPUP_STYLES}</style>
            
            <div className="flex-1 relative">
                <OperacionesMap 
                    center={[-31.4201, -64.1888]} 
                    objectives={logic.filteredObjectives} // 🛑 USAR FILTRADOS
                    processedData={logic.listData} 
                    onAction={logic.handleAction} 
                    setMapInstance={() => {}} 
                    currentFilter={logic.viewTab}
                />
            </div>

            <div className="h-16 bg-slate-800 border-t border-slate-700 flex items-center justify-between px-6 shadow-2xl z-[2000]">
                <div className="flex items-center gap-4">
                    <h1 className="font-black text-xl tracking-tighter text-indigo-400">COSP TACTICAL</h1>
                    <div className="h-8 w-px bg-slate-600"></div>
                    
                    {/* 🛑 NUEVO: SELECTOR DE CLIENTE */}
                    <select 
                        value={logic.selectedClientId} 
                        onChange={(e) => logic.setSelectedClientId(e.target.value)}
                        className="bg-slate-700 text-white text-xs font-bold p-2 rounded-lg border border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">TODOS LOS CLIENTES</option>
                        {logic.uniqueClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <div className="h-8 w-px bg-slate-600"></div>
                    <div className="text-xs font-mono text-slate-400">
                        {mounted ? logic.now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => logic.setViewTab('TODOS')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${logic.viewTab === 'TODOS' ? 'bg-slate-100 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><Layers size={14}/> TODOS ({logic.stats.total})</button>
                    <button onClick={() => logic.setViewTab('PRIORIDAD')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${logic.viewTab === 'PRIORIDAD' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><AlertTriangle size={14}/> ({logic.stats.prioridad})</button>
                    <button onClick={() => logic.setViewTab('RETENIDOS')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${logic.viewTab === 'RETENIDOS' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><Clock size={14}/> ({logic.stats.retenidos})</button>
                    <button onClick={() => logic.setViewTab('ACTIVOS')} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-all ${logic.viewTab === 'ACTIVOS' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><UserCheck size={14}/> ({logic.stats.activos})</button>
                </div>
            </div>
        </div>
    );
}
