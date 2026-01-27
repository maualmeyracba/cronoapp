
import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Radio, Search, CheckCircle, AlertTriangle, X, Loader2, ListFilter, Siren, Calendar, Building2, ExternalLink, LogOut, ClipboardList, Clock, Phone, MessageCircle, FileCheck, Printer, Hourglass, UserX, AlertOctagon, User, Shield, Maximize2, Minimize2, MonitorUp, LayoutTemplate, Layers, ChevronDown, ChevronRight, CheckSquare, Bug } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';
import RetentionModal from '@/components/operaciones/RetentionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { loading: () => <div className="h-full flex items-center justify-center text-slate-400">...</div>, ssr: false });

const formatTimeSimple = (dateObj: any) => { if (!dateObj) return '-'; try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : new Date(dateObj); return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch(e) { return '-'; } };
const formatSmartTime = (dateObj: any) => { if (!dateObj) return '--:--'; try { const d = dateObj.seconds ? new Date(dateObj.seconds * 1000) : (dateObj instanceof Date ? dateObj : new Date(dateObj)); if (isNaN(d.getTime())) return '--:--'; const now = new Date(); const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); if (isToday) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '--:--'; } };

// --- MODAL DE RESOLUCIÓN V7.58 ---
const ResolutionWizard = ({ isOpen, onClose, shift, onAssign, onAbsent, onNotify, employees }: any) => {
    const [step, setStep] = useState('MENU');
    const [selectedEmp, setSelectedEmp] = useState('');
    const [searchEmp, setSearchEmp] = useState('');

    if (!isOpen || !shift) return null;

    const filteredEmployees = employees.filter((e:any) => e.fullName.toLowerCase().includes(searchEmp.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2"><Siren className="text-rose-500 animate-pulse"/> Resolución de Incidencia</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6">
                    <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Turno Afectado</p>
                        <p className="font-bold text-slate-800">{shift.positionName}</p>
                        <p className="text-sm text-slate-600">{shift.clientName} - {shift.objectiveName}</p>
                        <p className="text-xs text-rose-600 font-mono mt-1">{shift.statusText}</p>
                    </div>

                    {step === 'MENU' && (
                        <div className="space-y-3">
                            <button onClick={() => setStep('COVER')} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-4 hover:bg-emerald-100 transition-all group">
                                <div className="bg-emerald-500 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><User size={24}/></div>
                                <div className="text-left"><h4 className="font-bold text-emerald-900">Cubrir Vacante</h4><p className="text-xs text-emerald-700">Asignar un reemplazo ahora</p></div>
                            </button>
                            <button onClick={() => { if(confirm('¿Confirmar ausencia? Se marcará en rojo.')) { onAbsent(shift.id); onClose(); }}} className="w-full p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-4 hover:bg-rose-100 transition-all group">
                                <div className="bg-rose-500 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><UserX size={24}/></div>
                                <div className="text-left"><h4 className="font-bold text-rose-900">Confirmar Ausencia</h4><p className="text-xs text-rose-700">El guardia no se presentó</p></div>
                            </button>
                            <button onClick={() => { onNotify(shift.id); onClose(); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4 hover:bg-slate-100 transition-all group">
                                <div className="bg-slate-500 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
                                <div className="text-left"><h4 className="font-bold text-slate-900">Solo Notificar</h4><p className="text-xs text-slate-600">Avisar a planificación (sin acción)</p></div>
                            </button>
                        </div>
                    )}

                    {step === 'COVER' && (
                        <div>
                            <input autoFocus type="text" placeholder="Buscar guardia..." value={searchEmp} onChange={e=>setSearchEmp(e.target.value)} className="w-full p-3 border rounded-xl mb-3 text-sm" />
                            <div className="h-48 overflow-y-auto border rounded-xl mb-4 divide-y">
                                {filteredEmployees.map((emp:any) => (
                                    <div key={emp.id} onClick={() => setSelectedEmp(emp.id)} className={`p-3 cursor-pointer hover:bg-blue-50 flex justify-between items-center text-sm ${selectedEmp===emp.id ? 'bg-blue-100 text-blue-800 font-bold' : ''}`}>
                                        <span>{emp.fullName}</span>
                                        {selectedEmp===emp.id && <CheckCircle size={16} className="text-blue-600"/>}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setStep('MENU')} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold">Volver</button>
                                <button disabled={!selectedEmp} onClick={() => { 
                                    const emp = employees.find((e:any)=>e.id===selectedEmp); 
                                    onAssign(shift.id, emp.id, emp.fullName); 
                                    onClose(); 
                                }} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50">Confirmar</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ... (Resto de componentes auxiliares como CheckOutModal se mantienen igual o se asumen existentes)
const CheckOutModal = ({ isOpen, onClose, onConfirm, employeeName }: any) => {
    const [novedad, setNovedad] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">Registrar Salida</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 space-y-4">
                    <p className="text-center text-slate-600">Salida de <b>{employeeName}</b></p>
                    <button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold flex justify-center gap-2"><FileCheck size={16}/> Salida Normal</button>
                    <div className="pt-2"><textarea className="w-full p-2 border rounded-lg text-sm mb-2" placeholder="Novedad (opcional)..." value={novedad} onChange={e=>setNovedad(e.target.value)}/><button onClick={() => { onConfirm(novedad); setNovedad(''); onClose(); }} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Salida con Novedad</button></div>
                </div>
            </div>
        </div>
    );
};

const ObjectiveGroupCard = ({ group, onBulkNotify }: any) => { /* ... (Igual a V7.41) ... */ return null; }; // Simplificado para este script, asumimos que usa la lista normal por ahora o el componente existe

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

    if (isCompact) return <div className="p-2 border rounded">Compact View (Not optimized)</div>;

    return (
        <div className={`p-5 rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all ${style.bg}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.border}`}></div>
            <div className="pl-2 flex justify-between items-start mb-1">
                 <div className="flex flex-col max-w-[70%]">
                     <span className={`text-[9px] font-bold uppercase tracking-wider w-fit px-1.5 py-0.5 rounded mb-1 ${style.badge}`}>{style.label}</span>
                     <h4 className="font-bold text-sm truncate text-slate-800">{isUnassigned ? 'PUESTO VACANTE' : shift.employeeName}</h4>
                     <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5"><Shield size={10}/> {shift.positionName}</div>
                 </div>
                 <div className="text-right"><div className="text-[11px] font-black font-mono text-slate-600 bg-white/50 px-1 rounded">{formatSmartTime(shift.shiftDateObj)}</div></div>
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
    const [checkoutData, setCheckoutData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    
    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <Head><title>COSP V7.58</title></Head>
            <style>{POPUP_STYLES}</style>
            <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4 p-2 animate-in fade-in">
                <div className="flex-1 lg:flex-[3] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative shadow-inner">
                    <OperacionesMap center={[-31.4201, -64.1888]} objectives={logic.objectives} processedData={logic.processedData} onAction={logic.handleAction} setMapInstance={() => {}} onOpenResolution={(s:any)=>setResolutionData({isOpen:true, shift:s})} onOpenCheckout={(s:any)=>setCheckoutData({isOpen:true, shift:s})} />
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl flex-1 lg:flex-[2]">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4"><Radio className="text-rose-600 animate-pulse" /> COSP V7.58</h2>
                        <div className="flex p-1 bg-slate-100 rounded-xl mb-3 gap-1 overflow-x-auto">
                            <button onClick={() => logic.setViewTab('PRIORIDAD')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'PRIORIDAD' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>Prioridad ({logic.stats.prioridad})</button>
                            <button onClick={() => logic.setViewTab('AUN_NO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'AUN_NO' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400'}`}>Aún No ({logic.stats.aunNo})</button>
                            <button onClick={() => logic.setViewTab('ACTIVOS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${logic.viewTab === 'ACTIVOS' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Activos ({logic.stats.activos})</button>
                        </div>
                        <div className="flex gap-2 relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="BUSCAR..." value={logic.filterText} onChange={(e) => logic.setFilterText(e.target.value)} /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 space-y-2">
                        {logic.listData.length === 0 ? <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">Sin Novedades</div> : logic.listData.map((s:any) => <GuardCard key={s.id} shift={s} onAction={logic.handleAction} onOpenResolution={(shift:any) => setResolutionData({isOpen:true, shift})} onOpenCheckout={(shift:any) => setCheckoutData({isOpen:true, shift})} />)}
                    </div>
                </div>
            </div>
            
            <ResolutionWizard 
                isOpen={resolutionData.isOpen} 
                onClose={() => setResolutionData({isOpen:false, shift:null})} 
                shift={resolutionData.shift} 
                employees={logic.employees}
                onAssign={logic.assignReemplazo}
                onAbsent={logic.markAbsent}
                onNotify={(id:string) => logic.confirmNovedad(id, 'Falta de Cobertura (Notificar)')}
            />
            
            <CheckOutModal isOpen={checkoutData.isOpen} onClose={() => setCheckoutData({isOpen:false, shift:null})} onConfirm={(nov:string|null) => logic.handleAction('CHECKOUT', checkoutData.shift.id, nov)} employeeName={checkoutData.shift?.employeeName} />
        </DashboardLayout>
    );
}
