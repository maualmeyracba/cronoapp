
import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Radio, Search, CheckCircle, AlertTriangle, X, Loader2, ListFilter, Siren, Calendar, Building2, ExternalLink, LogOut, ClipboardList, Clock, Phone, MessageCircle, FileCheck, Printer, Hourglass, UserX, AlertOctagon, User, Shield, Maximize2, Minimize2, MonitorUp, LayoutTemplate, Layers, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';
import AbsenceResolutionModal from '@/components/operaciones/AbsenceResolutionModal';
import RetentionModal from '@/components/operaciones/RetentionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { loading: () => <div className="h-full flex items-center justify-center text-slate-400">...</div>, ssr: false });

// --- HELPERS VISUALES ---
const formatTimeSimple = (dateObj: any) => {
    if (!dateObj) return '-';
    try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : new Date(dateObj); return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch(e) { return '-'; }
};
const formatSmartTime = (dateObj: any) => {
    if (!dateObj) return '--:--';
    try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : (dateObj instanceof Date ? dateObj : new Date(dateObj)); if (isNaN(d.getTime())) return '--:--'; const now = new Date(); const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); if (isToday) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '--:--'; }
};

// --- COMPONENTE: TARJETA AGRUPADA (NUEVO V7.41) ---
const ObjectiveGroupCard = ({ group, onBulkNotify }: any) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleNotifyAll = async (e: any) => {
        e.stopPropagation();
        if (confirm(`¿Confirmar notificación masiva de ${group.items.length} faltantes en ${group.objectiveName}?`)) {
            setIsProcessing(true);
            await onBulkNotify(group.items);
            setIsProcessing(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all">
            {/* Cabecera del Grupo */}
            <div 
                className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-200">
                        {group.items.length}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-slate-800">{group.objectiveName}</h4>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <Building2 size={10}/> {group.clientName}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {group.items.some((i:any) => i.hasPendingIssue || i.isSlaGap) && (
                        <button 
                            onClick={handleNotifyAll}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-rose-700 flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? <Loader2 size={12} className="animate-spin"/> : <BellRing size={12}/>}
                            {isProcessing ? 'Procesando...' : 'Notificar Todo'}
                        </button>
                    )}
                    {isExpanded ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                </div>
            </div>

            {/* Lista de Ítems */}
            {isExpanded && (
                <div className="divide-y divide-slate-50">
                    {group.items.map((shift: any) => (
                        <div key={shift.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-1 h-8 rounded-full ${shift.isSlaGap ? 'bg-rose-500' : 'bg-orange-400'}`}></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-700">{shift.positionName}</span>
                                        {shift.isSlaGap && <span className="text-[9px] bg-rose-100 text-rose-700 px-1 rounded font-bold">SLA</span>}
                                        {shift.isRetention && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">RET</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{formatSmartTime(shift.shiftDateObj)} - {formatTimeSimple(shift.endDateObj)}</div>
                                </div>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                                {shift.statusText}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
import { BellRing } from 'lucide-react'; // Importación adicional necesaria

const CheckOutModal = ({ isOpen, onClose, onConfirm, employeeName }: any) => {
    const [novedad, setNovedad] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-xl border dark:border-slate-800">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between"><h3 className="font-bold dark:text-white">Registrar Salida</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 space-y-4">
                    <p className="text-center text-slate-600 dark:text-slate-300">Confirmar salida de <b>{employeeName}</b></p>
                    <button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold flex justify-center gap-2"><FileCheck size={16}/> Salida Normal</button>
                    <div className="pt-2"><p className="text-xs uppercase text-slate-400 font-bold mb-2">O con novedad:</p><textarea className="w-full p-2 border rounded-lg text-sm mb-2" placeholder="Detalle..." value={novedad} onChange={e=>setNovedad(e.target.value)}/><button onClick={() => { onConfirm(novedad); setNovedad(''); onClose(); }} disabled={!novedad.trim()} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Reportar Novedad</button></div>
                </div>
            </div>
        </div>
    );
};

const GuardCard = ({ shift, onAction, onOpenResolution, onOpenCheckout, isCompact }: any) => {
    const { isRetention, hasPendingIssue, isPresent, isCompleted, isCriticallyLate, isSlaGap, isReported, isUnassigned, isLate, isAbsentUnwarned } = shift;
    const getStyles = () => {
        if (isSlaGap) return { border: 'border-l-red-600', bg: 'bg-red-50 dark:bg-red-950/50', badge: 'bg-red-600 text-white animate-pulse', label: 'FALTA SLA' };
        if (isUnassigned) return { border: 'border-l-red-600', bg: 'bg-red-50 dark:bg-red-900/30', badge: 'bg-red-600 text-white animate-pulse', label: 'VACANTE' };
        if (isRetention) return { border: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-600 text-white animate-pulse', label: 'RETENIDO' };
        if (isCriticallyLate) return { border: 'border-l-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40', badge: 'bg-rose-600 text-white animate-pulse', label: 'SIN REGISTRO' };
        if (isAbsentUnwarned) return { border: 'border-l-red-600', bg: 'bg-rose-50 dark:bg-rose-950/40', badge: 'bg-rose-600 text-white', label: 'AUSENTE S/A' };
        if (shift.isAbsent) return { border: 'border-l-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40', badge: 'bg-rose-600 text-white', label: 'AUSENTE' };
        if (isLate && !isPresent) return { border: 'border-l-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-800', label: 'TARDE' };
        if (isPresent) return { border: 'border-l-emerald-500', bg: 'bg-emerald-50/20 dark:bg-emerald-900/10', badge: 'bg-emerald-100 text-emerald-700', label: 'EN SERVICIO' };
        if (isCompleted) return { border: 'border-l-slate-300', bg: 'bg-slate-50', badge: 'bg-slate-200 text-slate-500', label: 'FINALIZADO' };
        return { border: 'border-l-slate-200', bg: 'bg-white', badge: 'bg-slate-100 text-slate-500', label: 'PROGRAMADO' };
    };
    const style = getStyles();
    const showActions = !isCompleted && (hasPendingIssue || isUnassigned || isPresent || isLate || isCriticallyLate || isSlaGap);

    if (isCompact) {
        return (
            <div className={`p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-2 ${style.bg} hover:shadow-md transition-all`}>
                <div className={`w-1 self-stretch rounded-full ${style.border.replace('border-l-', 'bg-')}`}></div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1 rounded ${style.badge}`}>{style.label.substring(0,5)}</span>
                        <span className="font-bold text-xs truncate">{isUnassigned ? (isSlaGap ? 'VACANTE CONTRATO' : 'VACANTE') : shift.employeeName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate flex gap-2"><span>{formatSmartTime(shift.shiftDateObj)}</span><span className="text-slate-300">|</span><span>{shift.clientName}</span></div>
                </div>
                {showActions && (
                    <div className="flex gap-1">
                        {(hasPendingIssue || isUnassigned || isSlaGap) && !isPresent ? (
                            <button onClick={() => onOpenResolution(shift)} className="p-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 animate-pulse" title="Resolver"><Siren size={14}/></button>
                        ) : (<>{!isPresent ? (<button onClick={() => onAction('CHECKIN', shift.id)} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700" title="Llegada"><CheckCircle size={14}/></button>) : (<button onClick={() => onOpenCheckout(shift)} className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700" title="Salida"><LogOut size={14}/></button>)}</>)}
                        {!isUnassigned && !isSlaGap && <button onClick={() => window.open(`tel:${shift.phone}`)} className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200"><Phone size={14}/></button>}
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className={`p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-md relative overflow-hidden group hover:shadow-lg transition-all ${style.bg}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.border}`}></div>
            {isRetention && (<div className="absolute top-2 right-2 flex items-center gap-1 text-orange-600 font-mono text-xs font-black bg-white/80 px-2 py-1 rounded shadow-sm animate-pulse"><Clock size={12}/> RETENCIÓN</div>)}
            <div className="pl-2 flex justify-between items-start mb-1">
                 <div className="flex flex-col max-w-[65%]">
                     <span className={`text-[9px] font-bold uppercase tracking-wider w-fit px-1.5 py-0.5 rounded mb-1 ${style.badge}`}>{style.label}</span>
                     <h4 className={`font-bold text-sm truncate ${isCompleted ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{isUnassigned ? (isSlaGap ? 'FALTA COBERTURA' : 'VACANTE') : shift.employeeName}</h4>
                     <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5"><Shield size={10} className="text-slate-400"/> {shift.positionName || 'Puesto General'}</div>
                 </div>
                 <div className="text-right"><div className="text-[11px] font-black font-mono text-slate-600 bg-white/50 px-1 rounded">{formatSmartTime(shift.shiftDateObj)}</div><div className="text-[9px] text-slate-400">a {formatTimeSimple(shift.endDateObj)}</div></div>
            </div>
            <div className="pl-2 mb-2 mt-1">
                <div className="text-xs text-slate-500 font-medium truncate flex items-center gap-1"><Building2 size={10} className="text-slate-400"/> {shift.clientName}</div>
                {isSlaGap && <div className="mt-1 text-[10px] text-rose-700 font-bold">🔴 Incumplimiento de Contrato</div>}
            </div>
            {showActions && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 flex gap-3">
                    {isCriticallyLate ? (
                        <><button onClick={() => onAction('NOVEDAD', shift.id)} className="flex-1 py-1.5 bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 hover:bg-rose-200 transition-colors"><AlertTriangle size={14}/> AUDITAR FALTA</button>
                        <button onClick={() => onAction('CHECKIN', shift.id)} className="px-3 bg-white border border-slate-200 text-slate-400 rounded-lg" title="Forzar Entrada"><CheckCircle size={14}/></button></>
                    ) : (hasPendingIssue || isUnassigned || isSlaGap) && !isPresent ? (
                        <button onClick={() => onOpenResolution(shift)} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 animate-pulse shadow-md"><Siren size={14}/> RESOLVER</button>
                    ) : (
                        <>{!isPresent ? (<button onClick={() => onAction('CHECKIN', shift.id)} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors">LLEGADA</button>) : (<button onClick={() => onOpenCheckout(shift)} className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-purple-700 transition-colors">SALIDA</button>)}<button onClick={() => onAction('NOVEDAD', shift.id)} className="px-3 bg-white border border-slate-200 text-slate-500 rounded-lg hover:text-rose-600"><AlertTriangle size={14}/></button></>
                    )}
                    {!isUnassigned && !isSlaGap && (<div className="flex gap-1 ml-1"><button onClick={() => window.open(`tel:${shift.phone}`)} className="p-2 bg-slate-100 rounded-lg text-slate-500"><Phone size={14}/></button><button onClick={() => window.open(`https://wa.me/${shift.phone?.replace(/\D/g,'')}`)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MessageCircle size={14}/></button></div>)}
                </div>
            )}
        </div>
    );
};

export default function OperacionesPage() {
    const logic = useOperacionesMonitor();
    const [isExternalMap, setIsExternalMap] = useState(false);
    const [wizardData, setWizardData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [retentionModal, setRetentionModal] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [checkoutData, setCheckoutData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    
    // --- ESTADO NUEVO: Agrupación ---
    const [isGrouped, setIsGrouped] = useState(false);

    const handleUndockMap = () => {
        const url = '/admin/operaciones/map-view';
        window.open(url, 'CronoMapTactical', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');
        setIsExternalMap(true);
    };

    const generateDailyReport = () => {
        const doc = new jsPDF(); const dateStr = new Date().toLocaleDateString('es-AR'); const auth = getAuth(); const currentUser = auth.currentUser; const operatorName = logic.formatName(currentUser); const startTimeStr = formatTimeSimple(logic.operatorInfo.startTime || new Date()); const endTimeStr = formatTimeSimple(new Date());
        doc.setFontSize(18); doc.text("Informe de Gestión COSP", 14, 20); doc.setFontSize(10); doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 30); doc.text(`Responsable: ${operatorName}`, 14, 36); doc.text(`Turno: ${startTimeStr} - ${endTimeStr}`, 14, 42); doc.setLineWidth(0.5); doc.line(14, 46, 196, 46);
        const rows = logic.recentLogs.map((log: any) => [formatTimeSimple(log.time), (log.action || 'LOG').replace('MANUAL_', ''), log.formattedActor || 'Sistema', log.targetEmployee || '-', log.fullDetail || log.details || '-']);
        autoTable(doc, { head: [["Hora", "Evento", "Operador", "Objetivo", "Detalle"]], body: rows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
        doc.save(`bitacora_${dateStr}.pdf`);
    };
    const openResolution = (shift: any) => { if (shift.isRetention) setRetentionModal({ isOpen: true, shift }); else setWizardData({ isOpen: true, shift }); };

    // --- ACCIÓN MASIVA (METRALLETA) ---
    const handleBulkNotify = async (items: any[]) => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        
        // Ejecutamos secuencialmente para no saturar y mantener el orden
        for (const item of items) {
             // Usamos la lógica de confirmNovedad directamente
             await logic.confirmNovedad(item.id, 'Falta de Cobertura (Notificar)');
             // Pequeña pausa para UI
             await new Promise(r => setTimeout(r, 200));
        }
        toast.success(`${items.length} faltantes notificados correctamente.`);
    };

    // --- LÓGICA DE AGRUPACIÓN ---
    const groupedData = useMemo(() => {
        if (!isGrouped) return [];
        const groups: Record<string, any> = {};
        logic.listData.forEach((shift: any) => {
            const key = shift.objectiveId || 'unknown';
            if (!groups[key]) {
                groups[key] = {
                    objectiveId: key,
                    objectiveName: shift.objectiveName || 'Objetivo Desconocido',
                    clientName: shift.clientName || 'Cliente',
                    items: []
                };
            }
            groups[key].items.push(shift);
        });
        return Object.values(groups);
    }, [logic.listData, isGrouped]);

    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <Head><title>COSP V7.55</title></Head>
            <style>{POPUP_STYLES}</style>
            <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4 p-2 animate-in fade-in">
                {!isExternalMap && (
                    <div className="flex-1 lg:flex-[3] bg-slate-100 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-inner">
                        <OperacionesMap center={[-31.4201, -64.1888]} objectives={logic.objectives} processedData={logic.processedData} onAction={logic.handleAction} setMapInstance={() => {}} onOpenResolution={openResolution} onOpenCheckout={(shift:any) => setCheckoutData({isOpen:true, shift})} />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 rounded-full px-6 py-2 flex gap-8 border shadow-xl">
                            <div className="text-center"><div className="text-xl font-black text-rose-500">{logic.stats.prioridad}</div><div className="text-[8px] font-bold text-slate-400 uppercase">PRIORIDAD</div></div>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="text-center"><div className="text-xl font-black text-emerald-600">{logic.stats.activos}</div><div className="text-[8px] font-bold text-slate-400 uppercase">ACTIVOS</div></div>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="text-center"><div className="text-xl font-black text-orange-500">{logic.stats.retenidos}</div><div className="text-[8px] font-bold text-slate-400 uppercase">RETENIDOS</div></div>
                        </div>
                        <button onClick={handleUndockMap} className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow hover:bg-slate-100" title="Desacoplar Mapa (Multi-Monitor)"><MonitorUp size={20} className="text-indigo-600"/></button>
                    </div>
                )}
                <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 flex flex-col shadow-xl ${isExternalMap ? 'w-full' : 'flex-1 lg:flex-[2]'}`}>
                    <div className="p-4 border-b">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Radio className="text-rose-600 animate-pulse" /> COSP V7.55</h2>
                            <div className="flex items-center gap-2">
                                {/* BOTÓN AGRUPAR (NUEVO) */}
                                <button 
                                    onClick={() => setIsGrouped(!isGrouped)} 
                                    className={`px-3 py-1 font-bold text-xs rounded-lg border flex items-center gap-2 transition-colors ${isGrouped ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <Layers size={14}/> {isGrouped ? 'Agrupado' : 'Sin Agrupar'}
                                </button>
                                
                                {isExternalMap && ( <button onClick={() => setIsExternalMap(false)} className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 flex items-center gap-2 hover:bg-indigo-100"><LayoutTemplate size={14}/> Restaurar Mapa</button> )}
                                <button onClick={() => logic.setIsCompact(!logic.isCompact)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">{logic.isCompact ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}</button>
                                <div className="bg-slate-100 px-2 py-1 text-xs font-mono rounded">{logic.now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                            </div>
                        </div>
                        <div className="flex p-1 bg-slate-100 rounded-xl mb-3 gap-1 overflow-x-auto">
                            <button onClick={() => logic.setViewTab('PRIORIDAD')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PRIORIDAD' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Prioridad ({logic.stats.prioridad})</button>
                            <button onClick={() => logic.setViewTab('RETENIDOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'RETENIDOS' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-400'}`}>Retenidos ({logic.stats.retenidos})</button>
                            <button onClick={() => logic.setViewTab('AUN_NO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'AUN_NO' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400'}`}>Aún No ({logic.stats.aunNo})</button>
                            <button onClick={() => logic.setViewTab('ACTIVOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'ACTIVOS' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Activos ({logic.stats.activos})</button>
                            <button onClick={() => logic.setViewTab('AUSENTES')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'AUSENTES' ? 'bg-white text-rose-700 shadow-md' : 'text-slate-400'}`}>Ausentes ({logic.stats.ausentes})</button>
                            <button onClick={() => logic.setViewTab('PLANIFICADO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PLANIFICADO' ? 'bg-white text-indigo-500 shadow-md' : 'text-slate-400'}`}>Plan ({logic.stats.planificado})</button>
                            <button onClick={() => logic.setViewTab('HOY')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'HOY' ? 'bg-white text-slate-700 shadow-md' : 'text-slate-400'}`}>Hist. Hoy ({logic.stats.total})</button>
                        </div>
                        <div className="flex gap-2 relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="BUSCAR..." value={logic.filterText} onChange={(e) => logic.setFilterText(e.target.value)} /></div>
                    </div>
                    
                    <div className={`flex-1 overflow-y-auto p-3 bg-slate-50/50 ${isExternalMap || isGrouped ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 content-start' : 'space-y-2'}`}>
                        {/* RENDERIZADO CONDICIONAL: AGRUPADO O PLANO */}
                        {isGrouped ? (
                            groupedData.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center h-40 text-slate-400 opacity-60"><Layers size={48} className="mb-2"/><p className="text-xs font-bold uppercase">Sin grupos activos</p></div>
                            ) : (
                                groupedData.map((group: any) => (
                                    <ObjectiveGroupCard key={group.objectiveId} group={group} onBulkNotify={handleBulkNotify} />
                                ))
                            )
                        ) : (
                            logic.listData.length === 0 ? (<div className="col-span-full flex flex-col items-center justify-center h-40 text-slate-400 opacity-60"><ListFilter size={48} className="mb-2"/><p className="text-xs font-bold uppercase">Sin turnos en esta vista</p></div>) : (logic.listData.map((s:any) => (<GuardCard key={s.id} shift={s} isCompact={logic.isCompact} onAction={logic.handleAction} onOpenResolution={openResolution} onOpenCheckout={(shift:any) => setCheckoutData({isOpen:true, shift})} />)))
                        )}
                    </div>

                    <div className="h-40 border-t border-slate-200 bg-white flex flex-col">
                        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between"><div className="flex items-center gap-2"><ClipboardList size={14} className="text-slate-400"/><h3 className="text-[10px] font-black uppercase text-slate-500">Bitácora</h3></div><button onClick={generateDailyReport} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><Printer size={12}/></button></div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-bold sticky top-0">
                                    <tr><th className="px-4 py-1">Hora</th><th className="px-2 py-1">Tipo</th><th className="px-2 py-1">Operador</th><th className="px-2 py-1">Objetivo</th><th className="px-2 py-1">Detalle</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">{logic.recentLogs.map((log:any) => (<tr key={log.id} className="hover:bg-slate-50"><td className="px-4 py-2 font-mono text-slate-400 w-16">{formatTimeSimple(log.time)}</td><td className="px-2 py-2"><span className="px-2 py-0.5 rounded-md font-bold uppercase text-[9px] border bg-slate-50 text-slate-600">{log.action?.replace('MANUAL_', '')}</span></td><td className="px-2 py-2 font-medium text-indigo-600 truncate max-w-[80px]" title={log.actor}><div className="flex items-center gap-1"><User size={10}/> {log.formattedActor || 'Operador'}</div></td><td className="px-2 py-2 font-bold text-slate-700 truncate max-w-[100px]">{log.targetEmployee || '-'}</td><td className="px-2 py-2 text-slate-500 truncate max-w-[150px]">{log.fullDetail}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <AbsenceResolutionModal 
                isOpen={wizardData.isOpen} 
                onClose={() => setWizardData({isOpen:false, shift: null})} 
                absenceShift={wizardData.shift} 
                onNotify={(shift) => { logic.confirmNovedad(shift.id, 'Falta de Cobertura (Notificar)'); setWizardData({isOpen:false, shift: null}); }}
                onCover={(shift) => { setWizardData({isOpen:false, shift: null}); }} 
            />
            
            <RetentionModal isOpen={retentionModal.isOpen} onClose={() => setRetentionModal({isOpen:false, shift: null})} retainedShift={retentionModal.shift} onResolve={() => setRetentionModal({isOpen:false, shift:null})} />
            <CheckOutModal isOpen={checkoutData.isOpen} onClose={() => setCheckoutData({isOpen:false, shift:null})} onConfirm={(nov:string|null) => logic.handleAction('CHECKOUT', checkoutData.shift.id, nov)} employeeName={checkoutData.shift?.employeeName} />
            {logic.modals.novedad && (<div className="fixed inset-0 z-[6000] bg-black/60 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold mb-4">Reportar Novedad</h3><select className="w-full mb-3 p-2 border rounded" value={logic.novedadData.tipo} onChange={(e) => logic.setNovedadData(d => ({...d, tipo: e.target.value}))}><option value="Llegada Tarde">Llegada Tarde</option><option value="Falta de Cobertura (Notificar)">Falta de Cobertura (Notificar a Planificación)</option><option value="Uniforme Incompleto">Uniforme Incompleto</option><option value="Sin Elementos EPP">Sin Elementos EPP</option></select><textarea className="w-full mb-4 p-2 border rounded text-sm" placeholder="Detalle..." value={logic.novedadData.nota} onChange={(e) => logic.setNovedadData(d => ({...d, nota: e.target.value}))} /><div className="flex gap-2"><button onClick={() => logic.confirmNovedad()} className="flex-1 bg-rose-600 text-white py-2 rounded font-bold">Confirmar</button><button onClick={() => logic.setModals(p=>({...p, novedad:false}))} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded font-bold">Cancelar</button></div></div></div>)}
        </DashboardLayout>
    );
}
