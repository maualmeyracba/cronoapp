const fs = require('fs');
const path = require('path');

console.log(`\n🔙 RESTAURANDO LÓGICA ORIGINAL (V8.0)`);
console.log(`1. Restaurando 'RetentionModal.tsx' (Lógica: Doble Turno / Relevo).`);
console.log(`2. Restaurando 'AbsenceResolutionModal.tsx' (Lógica: Notificar / Cubrir).`);
console.log(`3. Conectando Tablero Principal a estos componentes.`);

const DIR_COMPS = path.join('apps', 'web2', 'src', 'components', 'operaciones');
if (!fs.existsSync(DIR_COMPS)) fs.mkdirSync(DIR_COMPS, { recursive: true });

// 1. MODAL DE RETENCIÓN (CÓDIGO RECUPERADO DE TU CONTEXTO)
const RETENTION_CODE = `
import React, { useState, useEffect } from 'react';
import { X, Clock, UserCheck, ArrowRight, Shield, CalendarClock, User, Search, Phone, MessageCircle, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, updateDoc, doc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

const EmployeeCard = ({ data, actionLabel, onAction, colorClass, type }: any) => {
    let displayName = "Guardia Desconocido";
    if (data.employeeName && data.employeeName !== 'undefined undefined') {
        displayName = data.employeeName;
    } else if (data.firstName || data.lastName) {
        displayName = \`\${data.lastName || ''} \${data.firstName || ''}\`.trim();
    }
    const phone = data.phone || '';
    let details = type === 'SHIFT' && data.startTime ? 
        \`\${new Date(data.startTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - \${data.endTime ? new Date(data.endTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Indef.'}\` 
        : "Disponible";

    return (
        <div className={\`flex flex-col p-3 border rounded-xl bg-white hover:shadow-md transition-all group \${type === 'SHIFT' ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-emerald-500'}\`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={\`p-2 rounded-lg \${colorClass} bg-opacity-10 text-opacity-100\`}> <User size={18}/> </div>
                    <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{displayName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {type === 'SHIFT' ? <Clock size={10}/> : <CheckCircle size={10}/>} <span>{details}</span>
                        </div>
                    </div>
                </div>
                {phone && (
                    <div className="flex gap-1">
                        <button onClick={() => window.open(\`tel:\${phone}\`, '_self')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Llamar"><Phone size={14}/></button>
                        <button onClick={() => window.open(\`https://wa.me/\${phone.replace(/[^0-9]/g,'')}\`, '_blank')} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded" title="WhatsApp"><MessageCircle size={14}/></button>
                    </div>
                )}
            </div>
            {onAction && (
                <button onClick={() => onAction(data)} className={\`w-full text-[10px] font-bold uppercase py-1.5 rounded-lg border transition-all \${colorClass} bg-opacity-5 border-opacity-20 hover:bg-opacity-100 hover:text-white border-current mt-1\`}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

interface Props { isOpen: boolean; onClose: () => void; retainedShift: any; onResolve: () => void; }

export default function RetentionModal({ isOpen, onClose, retainedShift, onResolve }: Props) {
    const [step, setStep] = useState<'SELECT_ACTION' | 'SELECT_RELIEF'>('SELECT_ACTION');
    const [loading, setLoading] = useState(false);
    const [nextShiftCandidates, setNextShiftCandidates] = useState<any[]>([]);
    const [otherCandidates, setOtherCandidates] = useState<any[]>([]); 
    const [filteredOthers, setFilteredOthers] = useState<any[]>([]); 
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) { setStep('SELECT_ACTION'); setSearchTerm(''); loadReliefCandidates(); }
    }, [isOpen, retainedShift]);

    useEffect(() => {
        if (!searchTerm) { setFilteredOthers(otherCandidates); } 
        else {
            const lower = searchTerm.toLowerCase();
            setFilteredOthers(otherCandidates.filter(e => (e.lastName + ' ' + e.firstName).toLowerCase().includes(lower) || (e.fileNumber && e.fileNumber.includes(lower))));
        }
    }, [searchTerm, otherCandidates]);

    const logAudit = async (action: string, details: string) => {
        try {
            const auth = getAuth(); const user = auth.currentUser;
            await addDoc(collection(db, 'audit_logs'), {
                timestamp: serverTimestamp(), actorUid: user?.uid || 'system', actorName: user?.displayName || user?.email || 'Operador',
                module: 'OPERACIONES', action: action, details: details, targetShiftId: retainedShift.id, targetEmployee: retainedShift.employeeName, clientName: retainedShift.clientName
            });
        } catch(e) { console.error(e); }
    };

    const loadReliefCandidates = async () => {
        try {
            const now = new Date();
            const qNext = query(collection(db, 'turnos'), where('objectiveId', '==', retainedShift.objectiveId), where('startTime', '>=', Timestamp.fromDate(now)), orderBy('startTime', 'asc'));
            const qEmp = query(collection(db, 'empleados'), where('status', '==', 'active')); // Corrección 'activo' a 'active' si es necesario, revisa tu DB
            const [nextShiftsSnap, empSnap] = await Promise.all([getDocs(qNext), getDocs(qEmp)]);
            const allEmployees = empSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            const scheduledEmployeeIds = new Set(); const scheduledDataMap = new Map();

            nextShiftsSnap.docs.forEach(d => {
                const data = d.data();
                if (!scheduledEmployeeIds.has(data.employeeId)) {
                    scheduledEmployeeIds.add(data.employeeId);
                    scheduledDataMap.set(data.employeeId, { startTime: data.startTime.toDate(), shiftName: getShiftName(data.startTime.toDate()) });
                }
            });

            const priorityList: any[] = []; const othersList: any[] = [];
            allEmployees.forEach((emp: any) => {
                if (emp.id === retainedShift.employeeId) return;
                if (scheduledEmployeeIds.has(emp.id)) {
                    const scheduleInfo = scheduledDataMap.get(emp.id);
                    priorityList.push({ ...emp, nextShiftTime: scheduleInfo.startTime, shiftLabel: scheduleInfo.shiftName });
                } else { othersList.push(emp); }
            });
            priorityList.sort((a, b) => a.nextShiftTime - b.nextShiftTime);
            setNextShiftCandidates(priorityList); setOtherCandidates(othersList); setFilteredOthers(othersList);
        } catch (e) { console.error(e); toast.error("Error cargando lista de relevos"); }
    };

    const getShiftName = (date: Date) => {
        const h = date.getHours();
        if (h >= 6 && h < 14) return 'Turno Mañana';
        if (h >= 14 && h < 22) return 'Turno Tarde';
        return 'Turno Noche';
    };

    // ACCIÓN A: DOBLE TURNO
    const handleFullCoverage = async () => {
        if(!confirm(\`¿Confirmar DOBLE JORNADA para \${retainedShift.employeeName}?\`)) return;
        setLoading(true);
        try {
            const baseTime = retainedShift.endTime ? retainedShift.endTime.toDate().getTime() : new Date().getTime();
            const newEndTime = new Date(baseTime + (8 * 3600 * 1000)); 
            await updateDoc(doc(db, 'turnos', retainedShift.id), {
                endTime: Timestamp.fromDate(newEndTime), isRetention: false, isExtraShift: true, status: 'PRESENT', comments: 'Cobertura de turno completo (Resolución de Retención)', resolutionStatus: 'RESOLVED'
            });
            await logAudit('RETENCION_DOBLE_TURNO', \`Guardia \${retainedShift.employeeName} extendió a doble turno.\`);
            toast.success("Turno extendido (Doble Jornada)."); onResolve();
        } catch (e) { toast.error("Error al extender turno"); } finally { setLoading(false); }
    };

    // ACCIÓN B: RELEVO
    const handleReliefArrival = async (reliefEmployee: any, isScheduled: boolean) => {
        if(!confirm(\`¿CONFIRMAR RELEVO?\\n\\nEntra: \${reliefEmployee.lastName}\\nSale: \${retainedShift.employeeName}\`)) return;
        setLoading(true);
        try {
            const now = new Date();
            // 1. Cerrar Retención
            await updateDoc(doc(db, 'turnos', retainedShift.id), {
                status: 'COMPLETED', isCompleted: true, isRetention: false, realEndTime: serverTimestamp(), checkoutNote: \`Relevado por \${reliefEmployee.lastName}\`
            });
            // 2. Crear Turno del Relevo
            const estimatedEnd = new Date(now.getTime() + (8 * 3600 * 1000)); 
            await addDoc(collection(db, 'turnos'), {
                employeeId: reliefEmployee.id, employeeName: \`\${reliefEmployee.lastName}, \${reliefEmployee.firstName}\`, clientId: retainedShift.clientId, clientName: retainedShift.clientName,
                objectiveId: retainedShift.objectiveId, objectiveName: retainedShift.objectiveName, startTime: serverTimestamp(), endTime: Timestamp.fromDate(estimatedEnd),
                status: 'PRESENT', isPresent: true, isRelief: true, comments: \`Relevo de \${retainedShift.employeeName} \${isScheduled ? '(Programado)' : '(Cobertura)'}\`
            });
            await logAudit('RETENCION_RELEVO', \`Relevo asignado: \${reliefEmployee.lastName} libera a \${retainedShift.employeeName}.\`);
            toast.success(\`Relevo registrado exitosamente.\`); onResolve();
        } catch (e) { toast.error("Error al procesar relevo"); } finally { setLoading(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border dark:border-slate-800 flex flex-col max-h-[85vh]">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-5 border-b border-orange-100 dark:border-orange-800 flex justify-between items-center shrink-0">
                    <div><h3 className="font-black text-orange-700 dark:text-orange-400 flex items-center gap-2 text-lg"><Clock className="animate-pulse" size={24}/> FINALIZAR RETENCIÓN</h3><p className="text-sm text-orange-600/70 dark:text-orange-300/70 mt-1">Contacte al relevo antes de asignarlo.</p></div>
                    <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full transition-colors"><X size={24} className="text-orange-400 hover:text-orange-600"/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-slate-950">
                    {step === 'SELECT_ACTION' ? (
                        <>
                            <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4"><div className="bg-orange-100 p-3 rounded-xl text-orange-600"><User size={24}/></div><div><p className="text-xs text-slate-400 uppercase font-bold">Guardia Retenido</p><p className="text-lg font-black text-slate-800 dark:text-white">{retainedShift.employeeName}</p></div></div>
                                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold animate-pulse">EN ESPERA</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button onClick={() => setStep('SELECT_RELIEF')} className="p-6 bg-white dark:bg-slate-800 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col items-center gap-4 shadow-sm hover:shadow-xl"><div className="bg-indigo-100 p-4 rounded-full text-indigo-600"><UserCheck size={32}/></div><div><p className="font-bold text-lg text-slate-800 dark:text-white">Buscar Relevo</p><p className="text-sm text-slate-500 dark:text-slate-400">Contactar personal.</p></div><div className="mt-2 text-indigo-500 font-bold text-xs uppercase flex items-center gap-1">Ver Lista <ArrowRight size={12}/></div></button>
                                <button onClick={handleFullCoverage} disabled={loading} className="p-6 bg-white dark:bg-slate-800 border-2 border-emerald-100 hover:border-emerald-500 rounded-2xl flex flex-col items-center gap-4 shadow-sm hover:shadow-xl"><div className="bg-emerald-100 p-4 rounded-full text-emerald-600"><Shield size={32}/></div><div><p className="font-bold text-lg text-slate-800 dark:text-white">Doble Turno</p><p className="text-sm text-slate-500 dark:text-slate-400">Extender horario actual.</p></div><div className="mt-2 text-emerald-500 font-bold text-xs uppercase flex items-center gap-1">Confirmar <ArrowRight size={12}/></div></button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div><p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase mb-3 flex items-center gap-2"><CalendarClock size={16}/> Sugeridos (Próximos Turnos)</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{nextShiftCandidates.length === 0 ? <div className="col-span-full text-sm text-slate-400 italic p-4 border border-dashed rounded-xl text-center">Sin sugerencias.</div> : nextShiftCandidates.map(emp => <EmployeeCard key={emp.id} data={emp} type="SHIFT" actionLabel="ASIGNAR" colorClass="text-indigo-600 border-indigo-200 bg-indigo-50" onAction={(e:any) => handleReliefArrival(e, true)} />)}</div></div>
                            <hr className="border-slate-200 dark:border-slate-700"/>
                            <div className="flex flex-col h-[350px]"><div className="flex justify-between items-center mb-3"><p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Otros Disponibles</p><div className="relative w-1/2 md:w-1/3"><Search className="absolute left-3 top-2.5 text-slate-400" size={14}/><input className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div></div><div className="flex-1 overflow-y-auto custom-scrollbar">{filteredOthers.length === 0 ? <div className="text-center py-10 text-sm text-slate-400 italic">No se encontraron resultados.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filteredOthers.slice(0, 40).map(emp => <EmployeeCard key={emp.id} data={emp} type="EMPLOYEE" actionLabel="ASIGNAR" colorClass="text-emerald-600 border-emerald-200 bg-emerald-50" onAction={(e:any) => handleReliefArrival(e, false)} />)}</div>}</div></div>
                            <button onClick={() => setStep('SELECT_ACTION')} className="text-xs font-bold text-slate-400 hover:text-slate-600 underline w-full text-center pt-2">Volver</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
`;

// 2. MODAL DE RESOLUCIÓN DE AUSENCIA (CÓDIGO RECUPERADO)
const ABSENCE_CODE = `
import React from 'react';
import { X, Bell, UserPlus, AlertTriangle } from 'lucide-react';

interface AbsenceResolutionModalProps { isOpen: boolean; onClose: () => void; absenceShift: any; onNotify: (shift: any) => void; onCover: (shift: any) => void; }

export default function AbsenceResolutionModal({ isOpen, onClose, absenceShift, onNotify, onCover }: AbsenceResolutionModalProps) {
    if (!isOpen || !absenceShift) return null;
    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="bg-rose-50 border-b border-rose-100 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-rose-700 font-bold uppercase tracking-wider text-sm"><AlertTriangle size={18} /> PUESTO SIN ASIGNAR</div>
                    <button onClick={onClose} className="p-1 hover:bg-rose-100 rounded-full text-rose-400 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h3 className="text-rose-600 font-black text-xs uppercase mb-2">¡ALERTA DE PLANIFICACIÓN!</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">Este puesto figura vacante en el sistema.</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg mt-1">{absenceShift.positionName || 'Puesto General'} en {absenceShift.clientName}</p>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => onNotify(absenceShift)} className="w-full group relative flex items-center p-4 border-2 border-rose-100 rounded-xl hover:border-rose-500 hover:bg-rose-50 transition-all duration-200">
                            <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors"><Bell size={20} /></div>
                            <div className="ml-4 text-left"><h4 className="text-slate-900 font-bold text-sm group-hover:text-rose-700">Notificar a Planificación</h4><p className="text-slate-500 text-xs">Enviar alerta y cerrar incidencia por ahora.</p></div>
                        </button>
                        <button onClick={() => onCover(absenceShift)} className="w-full group relative flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200">
                            <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><UserPlus size={20} /></div>
                            <div className="ml-4 text-left"><h4 className="text-slate-900 font-bold text-sm group-hover:text-indigo-700">Cubrir Operativamente</h4><p className="text-slate-500 text-xs">Buscar relevo o guardia presente.</p></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
`;

// ESCRIBIR ARCHIVOS
try {
    fs.writeFileSync(path.join(DIR_COMPS, 'RetentionModal.tsx'), RETENTION_CODE);
    fs.writeFileSync(path.join(DIR_COMPS, 'AbsenceResolutionModal.tsx'), ABSENCE_CODE);
    console.log("✅ Componentes restaurados exitosamente.");
} catch (e) {
    console.error("❌ Error escribiendo componentes:", e);
}

// 3. ACTUALIZAR PÁGINA PRINCIPAL
const PATH_INDEX = path.join('apps', 'web2', 'src', 'pages', 'admin', 'operaciones', 'index.tsx');
const INDEX_CONTENT = `
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
        <div className={\`p-5 rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all \${style.bg}\`}>
            <div className={\`absolute left-0 top-0 bottom-0 w-1 \${style.border}\`}></div>
            <div className="pl-2 flex justify-between items-start mb-1">
                 <div className="flex flex-col max-w-[70%]">
                     <span className={\`text-[9px] font-bold uppercase tracking-wider w-fit px-1.5 py-0.5 rounded mb-1 \${style.badge}\`}>{style.label}</span>
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
                            <button onClick={() => logic.setViewTab('PRIORIDAD')} className={\`flex-1 py-2 text-[10px] font-black uppercase rounded-lg \${logic.viewTab === 'PRIORIDAD' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}\`}>Prioridad ({logic.stats.prioridad})</button>
                            <button onClick={() => logic.setViewTab('AUN_NO')} className={\`flex-1 py-2 text-[10px] font-black uppercase rounded-lg \${logic.viewTab === 'AUN_NO' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400'}\`}>Aún No ({logic.stats.aunNo})</button>
                            <button onClick={() => logic.setViewTab('ACTIVOS')} className={\`flex-1 py-2 text-[10px] font-black uppercase rounded-lg \${logic.viewTab === 'ACTIVOS' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}\`}>Activos ({logic.stats.activos})</button>
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
`;

try {
    fs.writeFileSync(PATH_INDEX, INDEX_CONTENT);
    console.log("✅ Página Index actualizada con los modales correctos.");
} catch (error) {
    console.error("❌ Error escribiendo index:", error);
}