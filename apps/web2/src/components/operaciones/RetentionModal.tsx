
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
        displayName = `${data.lastName || ''} ${data.firstName || ''}`.trim();
    }
    const phone = data.phone || '';
    let details = type === 'SHIFT' && data.startTime ? 
        `${new Date(data.startTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${data.endTime ? new Date(data.endTime.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Indef.'}` 
        : "Disponible";

    return (
        <div className={`flex flex-col p-3 border rounded-xl bg-white hover:shadow-md transition-all group ${type === 'SHIFT' ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-emerald-500'}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}> <User size={18}/> </div>
                    <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{displayName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {type === 'SHIFT' ? <Clock size={10}/> : <CheckCircle size={10}/>} <span>{details}</span>
                        </div>
                    </div>
                </div>
                {phone && (
                    <div className="flex gap-1">
                        <button onClick={() => window.open(`tel:${phone}`, '_self')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Llamar"><Phone size={14}/></button>
                        <button onClick={() => window.open(`https://wa.me/${phone.replace(/[^0-9]/g,'')}`, '_blank')} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded" title="WhatsApp"><MessageCircle size={14}/></button>
                    </div>
                )}
            </div>
            {onAction && (
                <button onClick={() => onAction(data)} className={`w-full text-[10px] font-bold uppercase py-1.5 rounded-lg border transition-all ${colorClass} bg-opacity-5 border-opacity-20 hover:bg-opacity-100 hover:text-white border-current mt-1`}>
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
        if(!confirm(`¿Confirmar DOBLE JORNADA para ${retainedShift.employeeName}?`)) return;
        setLoading(true);
        try {
            const baseTime = retainedShift.endTime ? retainedShift.endTime.toDate().getTime() : new Date().getTime();
            const newEndTime = new Date(baseTime + (8 * 3600 * 1000)); 
            await updateDoc(doc(db, 'turnos', retainedShift.id), {
                endTime: Timestamp.fromDate(newEndTime), isRetention: false, isExtraShift: true, status: 'PRESENT', comments: 'Cobertura de turno completo (Resolución de Retención)', resolutionStatus: 'RESOLVED'
            });
            await logAudit('RETENCION_DOBLE_TURNO', `Guardia ${retainedShift.employeeName} extendió a doble turno.`);
            toast.success("Turno extendido (Doble Jornada)."); onResolve();
        } catch (e) { toast.error("Error al extender turno"); } finally { setLoading(false); }
    };

    // ACCIÓN B: RELEVO
    const handleReliefArrival = async (reliefEmployee: any, isScheduled: boolean) => {
        if(!confirm(`¿CONFIRMAR RELEVO?\n\nEntra: ${reliefEmployee.lastName}\nSale: ${retainedShift.employeeName}`)) return;
        setLoading(true);
        try {
            const now = new Date();
            // 1. Cerrar Retención
            await updateDoc(doc(db, 'turnos', retainedShift.id), {
                status: 'COMPLETED', isCompleted: true, isRetention: false, realEndTime: serverTimestamp(), checkoutNote: `Relevado por ${reliefEmployee.lastName}`
            });
            // 2. Crear Turno del Relevo
            const estimatedEnd = new Date(now.getTime() + (8 * 3600 * 1000)); 
            await addDoc(collection(db, 'turnos'), {
                employeeId: reliefEmployee.id, employeeName: `${reliefEmployee.lastName}, ${reliefEmployee.firstName}`, clientId: retainedShift.clientId, clientName: retainedShift.clientName,
                objectiveId: retainedShift.objectiveId, objectiveName: retainedShift.objectiveName, startTime: serverTimestamp(), endTime: Timestamp.fromDate(estimatedEnd),
                status: 'PRESENT', isPresent: true, isRelief: true, comments: `Relevo de ${retainedShift.employeeName} ${isScheduled ? '(Programado)' : '(Cobertura)'}`
            });
            await logAudit('RETENCION_RELEVO', `Relevo asignado: ${reliefEmployee.lastName} libera a ${retainedShift.employeeName}.`);
            toast.success(`Relevo registrado exitosamente.`); onResolve();
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
