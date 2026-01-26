import React, { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
    ChevronLeft, ChevronRight, Search, Plus, 
    Users, Clock, X, UserPlus, ArrowRight, Eye, EyeOff, 
    CheckCircle, Trash2, ShieldAlert, User, Briefcase, Layers,
    Bell, CalendarX, Loader2, Stethoscope, MapPin, Lock, ShieldCheck, UserMinus,
    Save, Undo, Copy, History
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp, Timestamp, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

// --- CONFIGURACIÓN VISUAL ---
const SHIFT_STYLES: any = {
    'M': 'bg-blue-100 text-blue-700 border-blue-200',
    'T': 'bg-orange-100 text-orange-700 border-orange-200',
    'N': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'D12': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'N12': 'bg-purple-100 text-purple-700 border-purple-200',
    'F': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'PU': 'bg-pink-100 text-pink-700 border-pink-200',
    'A': 'bg-red-100 text-red-700 border-red-300 font-black pattern-diagonal',       
    'V': 'bg-teal-100 text-teal-700 border-teal-300 font-black',     
    'L': 'bg-purple-100 text-purple-700 border-purple-300 font-black', 
    'E': 'bg-rose-100 text-rose-700 border-rose-300 font-black',    
    'Ausencia con Aviso': 'bg-amber-100 text-amber-700 border-amber-300',
};

const DEFAULT_LIMITS = { weekly: 48, monthly: 200 };

const SHIFT_HOURS_LOOKUP: Record<string, number> = {
    'M': 8, 'T': 8, 'N': 8, 
    'D12': 12, 'N12': 12, 
    'PU': 12, 'F': 0,
    'V': 0, 'L': 0, 'A': 0, 'E': 0 
};

const getAbsenceCode = (type: string) => {
    if (!type) return 'A';
    const t = type.toLowerCase();
    if (t.includes('vacaci')) return 'V';
    if (t.includes('licencia')) return 'L';
    if (t.includes('enfermedad') || t.includes('medico')) return 'E';
    if (t.includes('ausencia') || t.includes('falta') || t.includes('aviso')) return 'A';
    return type.substring(0, 1).toUpperCase(); 
};

const getDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getDefaultStyle = (code: string) => SHIFT_STYLES[code] || 'bg-slate-100 text-slate-700 border-slate-300';

const ACTION_LABELS: Record<string, string> = {
    'MANUAL_CHECKIN': 'Presente Manual',
    'ASIGNACION_TURNO': 'Asignación',
    'ASIGNACION': 'Asignación',
    'ELIMINACION_TURNO': 'Eliminación',
    'ELIMINACION': 'Eliminación',
    'AUTORIZACION_EXCEPCION': 'Excepción Autorizada',
    'DESVINCULACION_OBJETIVO': 'Desvinculación Objetivo'
};

export default function PlanificacionPage() {
    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedObjective, setSelectedObjective] = useState('');
    const [forceShowAll, setForceShowAll] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Datos Principales
    const [employees, setEmployees] = useState<any[]>([]);
    const [shiftsMap, setShiftsMap] = useState<Record<string, any>>({});
    const [absencesMap, setAbsencesMap] = useState<Record<string, any>>({});
    const [clients, setClients] = useState<any[]>([]);
    const [agreements, setAgreements] = useState<any[]>([]);
    const [unifiedLogs, setUnifiedLogs] = useState<any[]>([]);
    
    // Notificaciones
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [highlightKey, setHighlightKey] = useState<string | null>(null);

    // Identidad
    const [operatorName, setOperatorName] = useState('Cargando...');
    const [usersMap, setUsersMap] = useState<Record<string, string>>({}); 

    // SLA Dinámico
    const [positionStructure, setPositionStructure] = useState<any[]>([]);

    // UI & Modales
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [addSearchTerm, setAddSearchTerm] = useState('');
    const [selectedCell, setSelectedCell] = useState<any>(null);

    // Modal Autorización
    const [pendingAssignment, setPendingAssignment] = useState<any>(null); 
    const [authWarningMessage, setAuthWarningMessage] = useState('');

    // --- NUEVO: ESTADO TRANSACCIONAL (MODO EXCEL) ---
    const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({}); // Cambios locales sin guardar
    const [selection, setSelection] = useState<{start: string | null, end: string | null}>({ start: null, end: null });
    const [isDragging, setIsDragging] = useState(false);
    
    // --- CARGA INICIAL ---
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const snap = await getDocs(collection(db, 'system_users'));
                const map: Record<string, string> = {};
                snap.docs.forEach(d => {
                    const u = d.data();
                    if (u.email) map[u.email] = u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email);
                });
                setUsersMap(map);
            } catch (e) { console.error(e); }
        };
        loadUsers();
        
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setOperatorName(user.displayName || user.email || "Usuario Desconocido");
            } else {
                setOperatorName("No Logueado");
            }
        });
        return () => unsubscribe();
    }, []);

    // --- SNAPSHOTS ---
    useEffect(() => {
        const unsubC = onSnapshot(collection(db, 'clients'), snap => setClients(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubAgreements = onSnapshot(collection(db, 'convenios'), snap => setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubE = onSnapshot(collection(db, 'empleados'), snap => setEmployees(snap.docs.map(d => ({
            id: d.id, 
            name: d.data().name || d.data().firstName + ' ' + d.data().lastName, 
            preferredObjectiveId: d.data().preferredObjectiveId,
            laborAgreement: d.data().laborAgreement
        }))));
        
        const unsubS = onSnapshot(collection(db, 'turnos'), snap => {
            const map: any = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.startTime?.seconds) {
                    const date = new Date(data.startTime.seconds * 1000);
                    const key = `${data.employeeId}_${getDateKey(date)}`;
                    map[key] = { id: d.id, ...data, code: data.code || data.type }; 
                }
            });
            setShiftsMap(map);
        });

        const unsubA = onSnapshot(collection(db, 'ausencias'), snap => {
            const map: any = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.startDate && data.endDate && data.employeeId) {
                    const [sY, sM, sD] = data.startDate.split('-').map(Number);
                    const [eY, eM, eD] = data.endDate.split('-').map(Number);
                    
                    let current = new Date(sY, sM - 1, sD);
                    const end = new Date(eY, eM - 1, eD);

                    while (current <= end) {
                        const key = `${data.employeeId}_${getDateKey(current)}`;
                        map[key] = { 
                            id: d.id, 
                            type: data.type || 'Ausencia', 
                            reason: data.reason,
                            status: data.status,
                            isAbsence: true
                        };
                        current.setDate(current.getDate() + 1);
                    }
                }
            });
            setAbsencesMap(map);
        });

        return () => { unsubC(); unsubE(); unsubS(); unsubA(); unsubAgreements(); };
    }, []);

    // --- LOGS ---
    useEffect(() => {
        const qLogs = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(30));
        const qAusencias = query(collection(db, 'ausencias'), limit(20));

        const unsubLogs = onSnapshot(qLogs, (snapLogs) => {
            const logItems = snapLogs.docs.map(d => ({
                id: d.id,
                source: 'AUDIT',
                timestamp: d.data().timestamp?.seconds * 1000,
                label: ACTION_LABELS[d.data().action] || d.data().action,
                detail: d.data().details,
                actor: d.data().actorName
            }));

            getDocs(qAusencias).then(snapAus => {
                const ausItems = snapAus.docs.map(d => ({
                    id: d.id,
                    source: 'AUSENCIA',
                    timestamp: new Date(d.data().createdAt || d.data().startDate).getTime(),
                    label: d.data().type || 'Ausencia',
                    detail: `${d.data().employeeName}: ${d.data().reason}`,
                    actor: 'RRHH',
                    critical: true
                }));
                const merged = [...logItems, ...ausItems].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
                setUnifiedLogs(merged);
            });
        });
        return () => unsubLogs();
    }, []);

    // --- NOTIFICACIONES ---
    useEffect(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const qAbsence = query(collection(db, 'ausencias'), where('startDate', '>=', todayStr));
        
        const unsubNotif = onSnapshot(qAbsence, (snap) => {
            const items = snap.docs
                .map(d => ({ ...d.data(), id: d.id }))
                .filter((d:any) => !d.viewed) 
                .map((d:any) => ({
                    id: d.id,
                    title: d.type,
                    msg: `${d.employeeName} - ${d.reason}`,
                    date: d.startDate,
                    employeeId: d.employeeId,
                    critical: true
                }));
            
            setNotifications(items);
            if (items.length > 0) setHasUnread(true);
        });
        return () => unsubNotif();
    }, []);

    // --- SLA ---
    useEffect(() => {
        if (!selectedClient || !selectedObjective) {
            setPositionStructure([]);
            return;
        }
        const fetchSLA = async () => {
            try {
                const q = query(collection(db, 'servicios_sla'), where('clientId', '==', selectedClient));
                const snap = await getDocs(q);
                const relevantService = snap.docs.map(d => d.data()).find(d => d.objectiveId === selectedObjective);
                const structure: any[] = [];

                if (relevantService && relevantService.positions) {
                    relevantService.positions.forEach((pos: any) => {
                        if (pos.allowedShiftTypes && pos.allowedShiftTypes.length > 0) {
                            structure.push({
                                positionName: pos.name || 'General',
                                shifts: pos.allowedShiftTypes.map((t: any) => ({
                                    code: t.code, name: t.name, startTime: t.startTime, endTime: t.endTime, hours: t.hours
                                }))
                            });
                        }
                    });
                }
                if (structure.length === 0) structure.push({ positionName: 'General', shifts: [{code:'M',name:'M',startTime:'06:00',hours:8}, {code:'T',name:'T',startTime:'14:00',hours:8}, {code:'N',name:'N',startTime:'22:00',hours:8}] });
                setPositionStructure(structure);
            } catch (e) { setPositionStructure([]); }
        };
        fetchSLA();
    }, [selectedClient, selectedObjective]);

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [currentDate]);

    const displayedEmployees = useMemo(() => {
        if (!selectedObjective && !forceShowAll) return [];
        let list = employees;
        if (selectedObjective && !forceShowAll) list = list.filter(e => e.preferredObjectiveId === selectedObjective);
        if (searchTerm) list = list.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

        return list.sort((a, b) => {
            const aHasActivity = daysInMonth.some(d => shiftsMap[`${a.id}_${getDateKey(d)}`] || absencesMap[`${a.id}_${getDateKey(d)}`]);
            const bHasActivity = daysInMonth.some(d => shiftsMap[`${b.id}_${getDateKey(d)}`] || absencesMap[`${b.id}_${getDateKey(d)}`]);
            if (aHasActivity && !bHasActivity) return -1; 
            if (!aHasActivity && bHasActivity) return 1;  
            return a.name.localeCompare(b.name);          
        });
    }, [employees, selectedObjective, forceShowAll, searchTerm, shiftsMap, absencesMap, daysInMonth]);

    const availableToAdd = useMemo(() => employees.filter(e => e.preferredObjectiveId !== selectedObjective && e.name.toLowerCase().includes(addSearchTerm.toLowerCase())), [employees, selectedObjective, addSearchTerm]);

    // ✅ VALIDACIÓN REGLAS
    const checkLaborRules = (empId: string, targetDate: Date, newHours: number) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return null;

        const rule = agreements.find(a => a.name === emp.laborAgreement) || 
                     agreements.find(a => a.name === 'General') || 
                     { maxHoursWeekly: DEFAULT_LIMITS.weekly, maxHoursMonthly: DEFAULT_LIMITS.monthly };

        const limitWeekly = parseInt(rule.maxHoursWeekly) || DEFAULT_LIMITS.weekly;
        const limitMonthly = parseInt(rule.maxHoursMonthly) || DEFAULT_LIMITS.monthly;

        const dateKey = getDateKey(targetDate);
        const existingShift = shiftsMap[`${empId}_${dateKey}`];
        if (existingShift && (existingShift.code === 'F' || existingShift.isFranco)) {
            return `ALERTA CRÍTICA: El empleado ya tiene un FRANCO asignado este día.`;
        }

        const targetMonthStr = targetDate.toISOString().slice(0, 7);
        let monthlyTotal = 0;
        Object.values(shiftsMap).forEach((s: any) => {
            if (s.employeeId === empId && s.code !== 'F') {
                const sDate = s.startTime?.seconds ? new Date(s.startTime.seconds * 1000) : new Date(s.startTime);
                if (sDate.toISOString().startsWith(targetMonthStr)) {
                    monthlyTotal += (SHIFT_HOURS_LOOKUP[s.code] || 8);
                }
            }
        });

        if ((monthlyTotal + newHours) > limitMonthly) {
            return `ALERTA MENSUAL: Límite de ${limitMonthly}hs superado. Acumulará ${monthlyTotal + newHours}hs.`;
        }

        let weeklyTotal = 0;
        let hasFrancoInWindow = false;
        
        for (let i = 1; i <= 6; i++) {
            const d = new Date(targetDate);
            d.setDate(d.getDate() - i);
            const key = `${empId}_${getDateKey(d)}`;
            const prevShift = shiftsMap[key];
            if (prevShift) {
                if (prevShift.code === 'F' || prevShift.isFranco) hasFrancoInWindow = true;
                else weeklyTotal += (SHIFT_HOURS_LOOKUP[prevShift.code] || 8);
            }
        }

        const projectedWeekly = weeklyTotal + newHours;
        if (!hasFrancoInWindow && projectedWeekly > limitWeekly) {
            return `ALERTA SEMANAL: Sin francos en 7 días.\nAcumula ${projectedWeekly}hs (Límite: ${limitWeekly}hs).`;
        }

        return null;
    };

    // --- NUEVO: LÓGICA DE SELECCIÓN Y MODO EXCEL ---
    const handleMouseDown = (key: string) => {
        if (!selectedObjective) return;
        setIsDragging(true);
        setSelection({ start: key, end: key });
    };

    const handleMouseEnter = (key: string) => {
        if (!isDragging) return;
        setSelection(prev => ({ ...prev, end: key }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Helper para saber si una celda está seleccionada
    const isCellSelected = (empId: string, day: Date) => {
        if (!selection.start || !selection.end) return false;
        
        // Descomponer claves: "empID_YYYY-MM-DD"
        const [startEmp, startDate] = selection.start.split('_');
        const [endEmp, endDate] = selection.end.split('_');
        
        const targetEmp = empId;
        const targetDate = getDateKey(day);

        // Lógica simple de rango (podría mejorarse con índices, pero esto funciona para demos)
        // Aquí simplificamos asumiendo selección lineal por ahora o de bloque si ordenamos
        // Para simplificar: Solo seleccionamos si coincide el empleado O el día en modo lineal
        // Implementación robusta requeriría índices de la tabla visualizada
        return (targetEmp === startEmp && targetEmp === endEmp && targetDate >= (startDate < endDate ? startDate : endDate) && targetDate <= (startDate > endDate ? startDate : endDate)) ||
               (selection.start === `${empId}_${getDateKey(day)}`); 
    };

    // --- GESTIÓN DE CAMBIOS PENDIENTES ---
    const applyBulkChange = (shiftConfig: any) => {
        if (!selection.start || !selection.end) return;
        
        // 1. Identificar rango de fechas
        const [startEmp, startDateStr] = selection.start.split('_');
        const [endEmp, endDateStr] = selection.end.split('_');
        
        // Solo permitimos selección horizontal (mismo empleado) por ahora para evitar caos
        if (startEmp !== endEmp) {
            toast.error("Por seguridad, la edición masiva solo está permitida para un mismo empleado a la vez.");
            return;
        }

        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        const minDate = start < end ? start : end;
        const maxDate = start > end ? start : end;

        const newChanges = { ...pendingChanges };
        
        // Recorrer días
        for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
            const key = `${startEmp}_${getDateKey(d)}`;
            
            if (shiftConfig === null) {
                // Borrar
                newChanges[key] = { isDeleted: true };
            } else {
                // Asignar
                newChanges[key] = {
                    ...shiftConfig,
                    isTemp: true
                };
            }
        }
        
        setPendingChanges(newChanges);
        setSelection({ start: null, end: null }); // Limpiar selección
        toast.info("Cambios en borrador. Recuerda GUARDAR.");
    };

    const handleDiscardChanges = () => {
        if(confirm("¿Descartar todos los cambios no guardados?")) {
            setPendingChanges({});
        }
    };

    const handleCommitChanges = async () => {
        if (Object.keys(pendingChanges).length === 0) return;
        if (!confirm(`¿Confirmar y guardar ${Object.keys(pendingChanges).length} cambios en la base de datos?`)) return;

        setIsProcessing(true);
        const batch = writeBatch(db);
        const changesLog: any[] = [];

        try {
            for (const [key, change] of Object.entries(pendingChanges)) {
                const [empId, dateStr] = key.split('_');
                const existingShift = shiftsMap[key]; // Turno real en BD

                // CASO BORRAR
                if (change.isDeleted) {
                    if (existingShift?.id) {
                        batch.delete(doc(db, 'turnos', existingShift.id));
                        changesLog.push({ type: 'DELETE', empId, date: dateStr });
                    }
                } 
                // CASO AGREGAR / EDITAR
                else {
                    // Si ya existe y es igual, ignorar
                    if (existingShift && existingShift.code === change.code) continue;

                    // Si existe otro turno ese día, borrarlo primero (reemplazo)
                    if (existingShift?.id) {
                        batch.delete(doc(db, 'turnos', existingShift.id));
                    }

                    // Crear nuevo
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const targetDate = new Date(y, m - 1, d);
                    const [startH, startM] = (change.startTime || '06:00').split(':').map(Number);
                    const start = new Date(targetDate);
                    start.setHours(startH, startM || 0, 0);
                    
                    const end = new Date(start);
                    if (change.code === 'F') end.setHours(23, 59, 59);
                    else end.setTime(start.getTime() + ((change.hours||8) * 3600000));

                    const ref = doc(collection(db, 'turnos'));
                    batch.set(ref, {
                        employeeId: empId,
                        clientId: selectedClient,
                        objectiveId: selectedObjective,
                        code: change.code,
                        type: change.name,
                        startTime: Timestamp.fromDate(start),
                        endTime: Timestamp.fromDate(end),
                        isFranco: change.code === 'F',
                        createdAt: serverTimestamp(),
                        comments: 'Carga Masiva (Planificador)'
                    });
                    changesLog.push({ type: 'CREATE', empId, date: dateStr, code: change.code });
                }
            }

            // Historial
            if (changesLog.length > 0) {
                const auth = getAuth();
                const user = auth.currentUser?.email || 'Sistema';
                await addDoc(collection(db, 'planificaciones_historial'), {
                    timestamp: serverTimestamp(),
                    user,
                    period: `${currentDate.getMonth()+1}-${currentDate.getFullYear()}`,
                    changeCount: changesLog.length,
                    changes: changesLog
                });
            }

            await batch.commit();
            setPendingChanges({});
            toast.success("Planificación guardada exitosamente");

        } catch (e) {
            console.error(e);
            toast.error("Error al guardar cambios");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- RENDER ---
    return (
        <DashboardLayout>
            <Head><title>Planificador V2</title></Head>
            <Toaster position="top-center" />
            <div className="flex flex-col h-[calc(100vh-100px)] p-2 space-y-4 animate-in fade-in" onMouseUp={handleMouseUp}>
                
                {/* HEADER */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border flex flex-wrap items-center gap-3 shrink-0 justify-between">
                    <div className="flex gap-2">
                        <select value={selectedClient} onChange={e => {setSelectedClient(e.target.value); setSelectedObjective(''); setSearchTerm(''); setForceShowAll(false); }} className="bg-slate-50 border p-2 rounded-xl text-xs font-bold w-40 outline-none">
                            <option value="">Cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={selectedObjective} onChange={e => { setSelectedObjective(e.target.value); setSearchTerm(''); setForceShowAll(false); }} className="bg-slate-50 border p-2 rounded-xl text-xs font-bold w-40 outline-none" disabled={!selectedClient}>
                            <option value="">Objetivo...</option>
                            {clients.find(c => c.id === selectedClient)?.objetivos?.map((o:any) => <option key={o.id||o.name} value={o.id||o.name}>{o.name}</option>)}
                        </select>
                    </div>

                    {/* BARRA DE ACCIONES DE GUARDADO (SOLO SI HAY CAMBIOS) */}
                    {Object.keys(pendingChanges).length > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-top-2 bg-amber-50 p-1 rounded-xl border border-amber-200">
                            <span className="text-[10px] font-black text-amber-700 px-2">{Object.keys(pendingChanges).length} cambios sin guardar</span>
                            <button onClick={handleDiscardChanges} className="p-2 hover:bg-amber-100 rounded-lg text-amber-600"><Undo size={16}/></button>
                            <button onClick={handleCommitChanges} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 shadow-md">
                                <Save size={14}/> GUARDAR TODO
                            </button>
                        </div>
                    )}

                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-1"><ChevronLeft size={16}/></button>
                        <span className="px-3 font-black text-xs w-24 text-center capitalize">{currentDate.toLocaleDateString('es-AR', {month:'long'})}</span>
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-1"><ChevronRight size={16}/></button>
                    </div>
                </div>

                {/* BARRA FLOTANTE DE EDICIÓN MASIVA (CUANDO SELECCIONAS) */}
                {selection.start && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white p-2 rounded-2xl shadow-2xl flex gap-2 animate-in zoom-in-95 items-center">
                        <span className="text-[10px] font-bold px-2">Asignar a selección:</span>
                        {['M','T','N','F'].map(code => (
                            <button key={code} onClick={() => applyBulkChange({ code, name: code === 'F' ? 'Franco' : 'Turno', hours: code==='F'?0:8 })} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-indigo-600 font-black text-xs transition-colors">
                                {code}
                            </button>
                        ))}
                        <div className="w-px h-6 bg-slate-600 mx-1"></div>
                        <button onClick={() => applyBulkChange(null)} className="p-2 hover:bg-rose-600 rounded-lg text-rose-300 hover:text-white transition-colors"><Trash2 size={16}/></button>
                        <button onClick={() => setSelection({start:null, end:null})} className="ml-2"><X size={16}/></button>
                    </div>
                )}

                {/* GRID PRINCIPAL */}
                {(!selectedObjective && !forceShowAll) ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed text-slate-400"><ShieldAlert size={48} className="mb-4 opacity-50"/><h3 className="text-lg font-black uppercase">Seleccione Objetivo</h3></div>
                ) : (
                    <div className="flex-1 bg-white rounded-2xl border shadow-xl overflow-hidden flex flex-col relative select-none">
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="border-collapse w-full">
                                <thead className="sticky top-0 z-30 bg-slate-100 shadow-md h-10">
                                    <tr>
                                        <th className="sticky left-0 z-40 bg-slate-100 p-2 text-left min-w-[200px] border-b border-r"><span className="text-[10px] font-black uppercase flex items-center gap-2"><Users size={12}/> Dotación ({displayedEmployees.length})</span></th>
                                        {daysInMonth.map(day => (
                                            <th key={day.toISOString()} className={`min-w-[36px] border-b border-r p-1 text-center ${[0,6].includes(day.getDay()) ? 'bg-slate-200' : ''}`}>
                                                <div className="flex flex-col items-center"><span className="text-[8px] font-black uppercase text-slate-500">{day.toLocaleDateString('es-AR', {weekday:'narrow'})}</span><span className="text-[10px] font-bold">{day.getDate()}</span></div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedEmployees.map(emp => (
                                        <tr key={emp.id} className="group hover:bg-slate-50">
                                            <td className="sticky left-0 z-20 bg-white p-2 border-r border-b shadow-sm group-hover:bg-slate-50">
                                                <div className="flex justify-between items-center w-32">
                                                    <span className="text-[10px] font-bold truncate">{emp.name}</span>
                                                </div>
                                            </td>
                                            {daysInMonth.map(day => {
                                                const key = `${emp.id}_${getDateKey(day)}`;
                                                const serverShift = shiftsMap[key];
                                                const pendingChange = pendingChanges[key];
                                                const absence = absencesMap[key];
                                                
                                                // Prioridad visual: 1. Cambio Pendiente 2. Ausencia 3. Turno Real
                                                let displayCode = null;
                                                let cellClass = "";
                                                
                                                // Estado visual de selección
                                                const isSelected = isCellSelected(emp.id, day);

                                                if (pendingChange) {
                                                    if (pendingChange.isDeleted) {
                                                        displayCode = <X size={12}/>;
                                                        cellClass = "bg-rose-50 text-rose-300";
                                                    } else {
                                                        displayCode = pendingChange.code;
                                                        cellClass = "bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-inset ring-amber-400"; // Amarillo = Borrador
                                                    }
                                                } else if (absence) {
                                                    displayCode = getAbsenceCode(absence.type);
                                                    cellClass = SHIFT_STYLES[displayCode] || SHIFT_STYLES['Ausencia con Aviso'];
                                                } else if (serverShift) {
                                                    displayCode = serverShift.code;
                                                    cellClass = getDefaultStyle(displayCode);
                                                }

                                                return (
                                                    <td 
                                                        key={key} 
                                                        onMouseDown={() => handleMouseDown(key)}
                                                        onMouseEnter={() => handleMouseEnter(key)}
                                                        className={`border-b border-r p-0.5 cursor-pointer text-center relative transition-colors ${isSelected ? 'bg-indigo-200' : ''}`}
                                                    >
                                                        <div className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-black ${cellClass} ${isSelected ? 'ring-2 ring-indigo-500 z-10' : ''}`}>
                                                            {displayCode}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
