
import React, { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Radio, Search, CheckCircle, AlertTriangle, X, Loader2, ListFilter, Siren, Calendar, Building2, ExternalLink, LogOut, ClipboardList, Clock, Phone, MessageCircle, FileCheck, Printer, Hourglass, UserX, AlertOctagon, User, Shield, Maximize2, Minimize2, MonitorUp, LayoutTemplate, Layers, ChevronDown, ChevronRight, CheckSquare, Bug } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';

// Importamos los modales restaurados
import RetentionModal from '@/components/operaciones/RetentionModal';
import AbsenceResolutionModal from '@/components/operaciones/AbsenceResolutionModal';

const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { loading: () => <div className="h-full flex items-center justify-center text-slate-400">...</div>, ssr: false });

const CheckOutModal = ({ isOpen, onClose, onConfirm, employeeName }: any) => {
    const [novedad, setNovedad] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
                <h3 className="font-bold mb-4">Salida: {employeeName}</h3>
                <button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold mb-2">Salida Normal</button>
                <textarea className="w-full p-2 border rounded mb-2" placeholder="Novedad..." value={novedad} onChange={e=>setNovedad(e.target.value)}/>
                <button onClick={() => { onConfirm(novedad); setNovedad(''); onClose(); }} className="w-full py-2 bg-slate-100 font-bold rounded">Reportar Novedad</button>
                <button onClick={onClose} className="mt-2 text-sm text-slate-400 w-full">Cancelar</button>
            </div>
        </div>
    );
};

const GuardCard = ({ shift, onAction, onOpenResolution, onOpenCheckout, isCompact }: any) => {
    const { isRetention, hasPendingIssue, isPresent, isCompleted, isCriticallyLate, isSlaGap, isUnassigned, isLate } = shift;
    const style = (() => {
        if (isSlaGap) return { border: 'border-l-red-600', bg: 'bg-red-50', badge: 'bg-red-600 text-white animate-pulse', label: 'FALTA SLA' };
        if (isUnassigned) return { border: 'border-l-red-600', bg: 'bg-red-50', badge: 'bg-red-600 text-white animate-pulse', label: 'VACANTE' };
        if (isRetention) return { border: 'border-l-orange-500', bg: 'bg-orange-50', badge: 'bg-orange-600 text-white animate-pulse', label: 'RETENIDO' };
        if (isCriticallyLate) return { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-600 text-white animate-pulse', label: 'SIN REGISTRO' };
        if (shift.isAbsent) return { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-600 text-white', label: 'AUSENTE' };
        if (isLate && !isPresent) return { border: 'border-l-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'TARDE' };
        if (isPresent) return { border: 'border-l-emerald-500', bg: 'bg-emerald-50/20', badge: 'bg-emerald-100 text-emerald-700', label: 'EN SERVICIO' };
        if (isCompleted) return { border: 'border-l-slate-300', bg: 'bg-slate-50', badge: 'bg-slate-200 text-slate-500', label: 'FINALIZADO' };
        return { border: 'border-l-slate-200', bg: 'bg-white', badge: 'bg-slate-100 text-slate-500', label: 'PROGRAMADO' };
    })();
    
    const showActions = !isCompleted;

    return (
        <div className={`p-5 rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all ${style.bg}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.border}`}></div>
            <div className="pl-2 flex justify-between items-start mb-1">
                 <div className="flex flex-col max-w-[70%]">
                     <span className={`text-[9px] font-bold uppercase tracking-wider w-fit px-1.5 py-0.5 rounded mb-1 ${style.badge}`}>{style.label}</span>
                     <h4 className="font-bold text-sm truncate text-slate-800">{isUnassigned ? 'PUESTO VACANTE' : shift.employeeName}</h4>
                     <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5"><Shield size={10}/> {shift.positionName}</div>
                 </div>
                 <div className="text-right"><div className="text-[11px] font-black font-mono text-slate-600 bg-white/50 px-1 rounded">--:--</div></div>
            </div>
            <div className="pl-2 mb-2 mt-1">
                <div className="text-xs text-slate-500 font-medium truncate flex items-center gap-1"><Building2 size={10}/> {shift.clientName}</div>
                <div className="text-[10px] text-slate-400 truncate ml-3">{shift.objectiveName}</div>
            </div>
            {showActions && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 flex gap-2">
                    <button onClick={() => onAction('INSPECT', shift.id)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:text-slate-600"><Bug size={14}/></button>
                    {(hasPendingIssue || isUnassigned || isSlaGap) && !isPresent ? (
                        <button onClick={() => onOpenResolution(shift)} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 animate-pulse shadow-md hover:bg-rose-700">
                            <Siren size={14}/> RESOLVER
                        </button>
                    ) : (
                        <>{!isPresent ? (
                            <button onClick={() => onAction('CHECKIN', shift.id)} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors">ENTRAR</button>
                        ) : (
                            <button onClick={() => onOpenCheckout(shift)} className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-purple-700 transition-colors">SALIR</button>
                        )}</>
                    )}
                </div>
            )}
        </div>
    );
};

export default function OperacionesPage() {
    const logic = useOperacionesMonitor();
    const [resolutionData, setResolutionData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [retentionModal, setRetentionModal] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [checkoutData, setCheckoutData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});

    // Enrutador de Modales
    const handleOpenResolution = (shift: any) => {
        if (shift.isRetention) {
            setRetentionModal({ isOpen: true, shift });
        } else {
            setResolutionData({ isOpen: true, shift });
        }
    };
    
    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <Head><title>COSP V8.0</title></Head>
            <style>{POPUP_STYLES}</style>
            <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4 p-2 animate-in fade-in">
                <div className="flex-1 lg:flex-[3] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative shadow-inner">
                    <OperacionesMap center={[-31.4201, -64.1888]} objectives={logic.objectives} processedData={logic.processedData} onAction={logic.handleAction} setMapInstance={() => {}} onOpenResolution={handleOpenResolution} onOpenCheckout={(s:any)=>setCheckoutData({isOpen:true, shift:s})} />
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl flex-1 lg:flex-[2]">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4"><Radio className="text-rose-600 animate-pulse" /> COSP V8.0</h2>
                        <div className="flex p-1 bg-slate-100 rounded-xl mb-3 gap-1 overflow-x-auto">
                            <button onClick={() => logic.setViewTab('PRIORIDAD')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PRIORIDAD' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Prioridad ({logic.stats.prioridad})</button>
                            <button onClick={() => logic.setViewTab('AUN_NO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'AUN_NO' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400'}`}>Aún No ({logic.stats.aunNo})</button>
                            <button onClick={() => logic.setViewTab('ACTIVOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'ACTIVOS' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Activos ({logic.stats.activos})</button>
                        </div>
                        <div className="flex gap-2 relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="BUSCAR..." value={logic.filterText} onChange={(e) => logic.setFilterText(e.target.value)} /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 space-y-2">
                        {logic.listData.length === 0 ? <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">Sin Novedades</div> : logic.listData.map((s:any) => <GuardCard key={s.id} shift={s} onAction={logic.handleAction} onOpenResolution={handleOpenResolution} onOpenCheckout={(shift:any) => setCheckoutData({isOpen:true, shift})} />)}
                    </div>
                </div>
            </div>
            
            {/* MODALES CONECTADOS */}
            <AbsenceResolutionModal 
                isOpen={resolutionData.isOpen} 
                onClose={() => setResolutionData({isOpen:false, shift:null})} 
                absenceShift={resolutionData.shift} 
                onCover={(shift) => {
                    // Aquí llamamos a tu función de cubrir (pendiente de implementar en el modal, pero la estructura está)
                    alert("Función de cubrir activada para " + shift.employeeName);
                    // logic.assignReemplazo(shift.id, ...);
                }}
                onNotify={(shift) => logic.confirmNovedad(shift.id, 'Falta de Cobertura (Notificar)')}
            />

            <RetentionModal 
                isOpen={retentionModal.isOpen} 
                onClose={() => setRetentionModal({isOpen:false, shift:null})} 
                retainedShift={retentionModal.shift} 
                onResolve={() => setRetentionModal({isOpen:false, shift:null})}
            />

            <CheckOutModal isOpen={checkoutData.isOpen} onClose={() => setCheckoutData({isOpen:false, shift:null})} onConfirm={(nov:string|null) => logic.handleAction('CHECKOUT', checkoutData.shift.id, nov)} employeeName={checkoutData.shift?.employeeName} />
        </DashboardLayout>
    );
}
