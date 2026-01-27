
import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Radio, Search, Layers, Maximize2, Minimize2, MonitorUp, Building2, Shield, Clock, Siren, CheckCircle, LogOut, AlertTriangle, ClipboardList, Printer, Phone, MessageCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';
import AbsenceResolutionModal from '@/components/operaciones/AbsenceResolutionModal';
import RetentionModal from '@/components/operaciones/RetentionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { loading: () => <div className="h-full flex items-center justify-center text-slate-400">Cargando Mapa...</div>, ssr: false });

const formatTimeSimple = (dateObj: any) => { if (!dateObj) return '-'; try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : (dateObj instanceof Date ? dateObj : new Date(dateObj)); return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Cordoba' }); } catch(e) { return '-'; } };
const formatSmartTime = (dateObj: any) => { if (!dateObj) return '--:--'; try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : (dateObj instanceof Date ? dateObj : new Date(dateObj)); if (isNaN(d.getTime())) return '--:--'; const now = new Date(); const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); if (isToday) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Cordoba' }); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Cordoba' }); } catch (e) { return '--:--'; } };

const CheckOutModal = ({ isOpen, onClose, onConfirm, employeeName }: any) => { const [novedad, setNovedad] = useState(''); if (!isOpen) return null; return (<div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6"><h3 className="font-bold mb-4">Salida: {employeeName}</h3><button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold mb-2">Salida Normal</button><textarea className="w-full p-2 border rounded mb-2" placeholder="Novedad..." value={novedad} onChange={e=>setNovedad(e.target.value)}/><button onClick={() => { onConfirm(novedad); setNovedad(''); onClose(); }} className="w-full py-2 bg-slate-100 font-bold rounded">Reportar y Salir</button><button onClick={onClose} className="mt-2 text-sm text-slate-400 w-full">Cancelar</button></div></div>); };
const ObjectiveGroupCard = ({ group, onBulkNotify }: any) => { const [isExpanded, setIsExpanded] = useState(true); const [isProcessing, setIsProcessing] = useState(false); const handleNotifyAll = async (e: any) => { e.stopPropagation(); if (confirm(`¿Confirmar notificación masiva de ${group.items.length} faltantes?`)) { setIsProcessing(true); await onBulkNotify(group.items); setIsProcessing(false); } }; return (<div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all"><div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-200">{group.items.length}</div><div><h4 className="font-bold text-sm text-slate-800">{group.objectiveName}</h4><div className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Building2 size={10}/> {group.clientName}</div></div></div><div className="flex items-center gap-2">{group.items.some((i:any) => i.hasPendingIssue || i.isSlaGap) && (<button onClick={handleNotifyAll} disabled={isProcessing} className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-rose-700 flex items-center gap-1 shadow-sm disabled:opacity-50">{isProcessing ? <Loader2 size={12} className="animate-spin"/> : <BellRing size={12}/>} Notificar Todo</button>)}{isExpanded ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}</div></div>{isExpanded && (<div className="divide-y divide-slate-50">{group.items.map((shift: any) => (<div key={shift.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50"><div className="flex items-center gap-3"><div className={`w-1 h-8 rounded-full ${(shift.isSlaGap || shift.isUnassigned) ? 'bg-rose-500' : (shift.isRetention ? 'bg-orange-500' : 'bg-slate-300')}`}></div><div><div className="flex items-center gap-2"><span className="font-bold text-xs text-slate-700">{shift.positionName}</span>{(shift.isSlaGap || shift.isUnassigned) && <span className="text-[9px] bg-rose-100 text-rose-700 px-1 rounded font-bold">VACANTE</span>}{shift.isRetention && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">RET</span>}</div><div className="text-[10px] text-slate-500">{formatSmartTime(shift.shiftDateObj)} - {formatTimeSimple(shift.endDateObj)}</div></div></div><div className="text-[10px] font-mono text-slate-400">{shift.statusText}</div></div>))}</div>)}</div>); };
const GuardCard = ({ shift, onAction, onOpenResolution, onOpenCheckout, isCompact }: any) => { const { isRetention, hasPendingIssue, isPresent, isCompleted, isCriticallyLate, isSlaGap, isUnassigned, isLate, isAbsent } = shift; const getStyles = () => { if (isSlaGap) return { border: 'border-l-red-600', bg: 'bg-red-50', badge: 'bg-red-600 text-white animate-pulse', label: 'FALTA SLA' }; if (isUnassigned) return { border: 'border-l-red-600', bg: 'bg-red-50', badge: 'bg-red-600 text-white animate-pulse', label: 'VACANTE' }; if (isRetention) return { border: 'border-l-orange-500', bg: 'bg-orange-50', badge: 'bg-orange-600 text-white animate-pulse', label: 'RETENIDO' }; if (isCriticallyLate) return { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-600 text-white animate-pulse', label: 'SIN REGISTRO' }; if (isAbsent) return { border: 'border-l-slate-500', bg: 'bg-slate-100', badge: 'bg-slate-500 text-white', label: 'AUSENTE' }; if (isLate && !isPresent) return { border: 'border-l-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'TARDE' }; if (isPresent) return { border: 'border-l-emerald-500', bg: 'bg-emerald-50/20', badge: 'bg-emerald-100 text-emerald-700', label: 'EN SERVICIO' }; if (isCompleted) return { border: 'border-l-slate-300', bg: 'bg-slate-50', badge: 'bg-slate-200 text-slate-500', label: 'FINALIZADO' }; return { border: 'border-l-slate-200', bg: 'bg-white', badge: 'bg-slate-100 text-slate-500', label: 'PROGRAMADO' }; }; const style = getStyles(); const showActions = !isCompleted && !shift.isReported && (hasPendingIssue || isPresent || isLate || isAbsent || isUnassigned); if (isCompact) { return (<div className={`p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-2 ${style.bg} hover:shadow-md transition-all`}> <div className={`w-1 self-stretch rounded-full ${style.border.replace('border-l-', 'bg-')}`}></div> <div className="flex-1 min-w-0"> <div className="flex items-center gap-2"> <span className={`text-[9px] font-bold px-1 rounded ${style.badge}`}>{style.label.substring(0,8)}</span> <span className="font-bold text-xs truncate">{isUnassigned ? 'VACANTE' : shift.employeeName}</span> </div> <div className="text-[10px] text-slate-500 truncate">{shift.clientName}</div> </div> {showActions && (<div className="flex gap-1"> {(hasPendingIssue || isUnassigned || isSlaGap) && !isPresent ? (<button onClick={() => onOpenResolution(shift)} className="p-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 animate-pulse"><Siren size={14}/></button>) : (<>{!isPresent ? (<button onClick={() => onAction('CHECKIN', shift.id)} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><CheckCircle size={14}/></button>) : (<button onClick={() => onOpenCheckout(shift)} className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"><LogOut size={14}/></button>)}</>)} </div>)} </div>); } return (<div className={`p-5 rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all ${style.bg}`}> <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.border}`}></div> {isRetention && (<div className="absolute top-2 right-2 flex items-center gap-1 text-orange-600 font-mono text-xs font-black bg-white/80 px-2 py-1 rounded shadow-sm animate-pulse"><Clock size={12}/> RETENCIÓN</div>)} <div className="pl-2 flex justify-between items-start mb-1"> <div className="flex flex-col max-w-[65%]"> <span className={`text-[9px] font-bold uppercase tracking-wider w-fit px-1.5 py-0.5 rounded mb-1 ${style.badge}`}>{style.label}</span> <h4 className="font-bold text-sm truncate text-slate-800">{isUnassigned ? 'PUESTO VACANTE' : shift.employeeName}</h4> <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5"><Shield size={10}/> {shift.positionName || 'General'}</div> </div> <div className="text-right"><div className="text-[11px] font-black font-mono text-slate-600 bg-white/50 px-1 rounded">{formatSmartTime(shift.shiftDateObj)}</div></div> </div> <div className="pl-2 mb-2 mt-1"> <div className="text-xs text-slate-500 font-medium truncate flex items-center gap-1"><Building2 size={10}/> {shift.clientName}</div> {isSlaGap && <div className="mt-1 text-[10px] text-rose-700 font-bold">🔴 Falta Cobertura Contractual</div>} </div> {showActions && (<div className="mt-4 pt-4 border-t border-slate-200/50 flex gap-3"> {(hasPendingIssue || isUnassigned || isSlaGap || isAbsent) && !isPresent ? (<button onClick={() => onOpenResolution(shift)} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 animate-pulse shadow-md hover:bg-rose-700"><Siren size={14}/> {isUnassigned ? 'CUBRIR VACANTE' : 'AUDITAR FALTA'}</button>) : (<>{!isPresent ? (<button onClick={() => onAction('CHECKIN', shift.id)} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors">ENTRAR</button>) : (<button onClick={() => onOpenCheckout(shift)} className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-purple-700 transition-colors">SALIR</button>)}{!isPresent && <button onClick={() => onOpenResolution(shift)} className="px-3 bg-white border border-slate-200 text-slate-500 rounded-lg hover:text-rose-600"><AlertTriangle size={14}/></button>}</>)} {!isUnassigned && !isSlaGap && shift.phone && (<div className="flex gap-1 ml-1"><button onClick={() => window.open(`tel:${shift.phone}`)} className="p-2 bg-slate-100 rounded-lg text-slate-500"><Phone size={14}/></button><button onClick={() => window.open(`https://wa.me/${shift.phone?.replace(/\D/g,'')}`)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MessageCircle size={14}/></button></div>)} </div>)} </div>); };

export default function OperacionesPage() {
    const logic = useOperacionesMonitor();
    const [isExternalMap, setIsExternalMap] = useState(false);
    const [wizardData, setWizardData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [retentionModal, setRetentionModal] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [checkoutData, setCheckoutData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [isGrouped, setIsGrouped] = useState(false);

    const handleUndockMap = () => { window.open('/admin/operaciones/map-view', 'CronoMapTactical', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'); setIsExternalMap(true); };
    const generateDailyReport = () => { const doc = new jsPDF(); const dateStr = new Date().toLocaleDateString('es-AR'); doc.setFontSize(18); doc.text("Informe de Gestión COSP", 14, 20); doc.setFontSize(10); doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 30); doc.text(`Responsable: ${logic.operatorInfo.name}`, 14, 36); doc.setLineWidth(0.5); doc.line(14, 46, 196, 46); const rows = logic.recentLogs.map((log: any) => [formatTimeSimple(log.time), (log.action || 'LOG').replace('MANUAL_', ''), log.formattedActor || 'Sistema', log.targetEmployee || '-', log.fullDetail || log.details || '-']); autoTable(doc, { head: [["Hora", "Evento", "Operador", "Objetivo", "Detalle"]], body: rows, startY: 50, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } }); doc.save(`bitacora_${dateStr}.pdf`); };
    const groupedData = useMemo(() => { if (!isGrouped) return []; const groups: Record<string, any> = {}; logic.listData.forEach((shift: any) => { const key = shift.objectiveId || 'unknown'; if (!groups[key]) { groups[key] = { objectiveId: key, objectiveName: shift.objectiveName || 'Desconocido', clientName: shift.clientName || 'Cliente', items: [] }; } groups[key].items.push(shift); }); return Object.values(groups); }, [logic.listData, isGrouped]);

    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <Head><title>COSP V30.0</title></Head>
            <style>{POPUP_STYLES}</style>
            
            <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4 p-2 animate-in fade-in">
                {!isExternalMap && (
                    <div className="flex-1 lg:flex-[3] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative shadow-inner">
                        {/* 🛑 FIX: PASAR OBJETIVOS FILTRADOS AL MAPA */}
                        <OperacionesMap 
                            center={[-31.4201, -64.1888]} 
                            objectives={logic.filteredObjectives} 
                            processedData={logic.listData} 
                            onAction={logic.handleAction} 
                            setMapInstance={()=>{}} 
                            onOpenResolution={(s:any)=>setWizardData({isOpen:true, shift:s})} 
                            onOpenCheckout={(s:any)=>setCheckoutData({isOpen:true, shift:s})} 
                            currentFilter={logic.viewTab}
                        />
                        <button onClick={handleUndockMap} className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow hover:bg-slate-100"><MonitorUp size={20} className="text-indigo-600"/></button>
                    </div>
                )}

                <div className={`bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl ${isExternalMap ? 'w-full' : 'flex-1 lg:flex-[2]'}`}>
                    <div className="p-4 border-b">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Radio className="text-rose-600 animate-pulse" /> COSP V30.0</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsGrouped(!isGrouped)} className="px-3 py-1 font-bold text-xs rounded-lg border flex items-center gap-2 transition-colors hover:bg-slate-50"><Layers size={14}/> {isGrouped ? 'Agrupado' : 'Lista'}</button>
                                {isExternalMap && <button onClick={() => setIsExternalMap(false)} className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border">Restaurar Mapa</button>}
                                <button onClick={() => logic.setIsCompact(!logic.isCompact)} className="p-2 bg-slate-100 rounded-lg text-slate-600">{logic.isCompact ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}</button>
                            </div>
                        </div>
                        
                        {/* 🛑 NUEVO: SELECTOR DE CLIENTE */}
                        <div className="mb-3">
                            <select 
                                value={logic.selectedClientId} 
                                onChange={(e) => logic.setSelectedClientId(e.target.value)}
                                className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                            >
                                <option value="">TODOS LOS CLIENTES</option>
                                {logic.uniqueClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="flex p-1 bg-slate-100 rounded-xl mb-3 gap-1 overflow-x-auto">
                            <button onClick={() => logic.setViewTab('TODOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'TODOS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Todos ({logic.stats.total})</button>
                            <button onClick={() => logic.setViewTab('PRIORIDAD')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PRIORIDAD' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Prioridad ({logic.stats.prioridad})</button>
                            <button onClick={() => logic.setViewTab('RETENIDOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'RETENIDOS' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-400'}`}>Retenidos ({logic.stats.retenidos})</button>
                            <button onClick={() => logic.setViewTab('PLANIFICADO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PLANIFICADO' ? 'bg-white text-indigo-500 shadow-md' : 'text-slate-400'}`}>Plan ({logic.stats.planificado})</button>
                            <button onClick={() => logic.setViewTab('ACTIVOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'ACTIVOS' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Activos ({logic.stats.activos})</button>
                            <button onClick={() => logic.setViewTab('AUSENTES')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'AUSENTES' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-400'}`}>Ausentes ({logic.stats.ausentes})</button>
                        </div>

                        <div className="flex gap-2 relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="BUSCAR..." value={logic.filterText} onChange={(e) => logic.setFilterText(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 space-y-2">
                        {logic.listData.length === 0 ? 
                        <div className="text-center py-10 text-slate-400 text-xs">Sin novedades</div> : 
                        logic.listData.map((s:any) => 
                            <GuardCard 
                                key={s.id} 
                                shift={s} 
                                onAction={logic.handleAction} 
                                onOpenResolution={(s:any)=>setWizardData({isOpen:true, shift:s})} 
                                onOpenCheckout={(s:any)=>setCheckoutData({isOpen:true, shift:s})} 
                                isCompact={logic.isCompact} 
                            />
                        )}
                    </div>

                    <div className="h-40 border-t border-slate-200 bg-white flex flex-col">
                        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2"><ClipboardList size={14} className="text-slate-400"/><h3 className="text-[10px] font-black uppercase text-slate-500">Bitácora</h3></div>
                            <button onClick={generateDailyReport} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><Printer size={12}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-bold sticky top-0"><tr><th className="px-4 py-1">Hora</th><th className="px-2 py-1">Evento</th><th className="px-2 py-1">Actor</th><th className="px-2 py-1">Detalle</th></tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {logic.recentLogs.map((log:any) => (
                                        <tr key={log.id}>
                                            <td className="px-4 py-1 font-mono text-slate-400">{formatTimeSimple(log.time)}</td>
                                            <td className="px-2 py-1 font-bold">{log.action}</td>
                                            <td className="px-2 py-1">{log.formattedActor}</td>
                                            <td className="px-2 py-1 text-slate-500 truncate max-w-[150px]">{log.fullDetail}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <AbsenceResolutionModal isOpen={wizardData.isOpen} onClose={() => setWizardData({isOpen:false, shift:null})} absenceShift={wizardData.shift} onResolve={() => setWizardData({isOpen:false, shift:null})} />
            <RetentionModal isOpen={retentionModal.isOpen} onClose={() => setRetentionModal({isOpen:false, shift:null})} retainedShift={retentionModal.shift} onResolve={() => setRetentionModal({isOpen:false, shift:null})} />
            <CheckOutModal isOpen={checkoutData.isOpen} onClose={() => setCheckoutData({isOpen:false, shift:null})} onConfirm={(nov:string|null) => { if (checkoutData.shift?.id) logic.handleAction('CHECKOUT', checkoutData.shift.id, nov); }} employeeName={checkoutData.shift?.employeeName} />
        </DashboardLayout>
    );
}
