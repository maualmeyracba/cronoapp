import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
    ChevronLeft, ChevronRight, Search, Plus, 
    Users, Clock, X, UserPlus, ArrowRight, Eye, EyeOff, 
    CheckCircle, Trash2, ShieldAlert, User, Briefcase, Layers,
    Bell, CalendarX, Loader2, Stethoscope, MapPin, Lock, ShieldCheck, UserMinus
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp, Timestamp, where, getDocs, updateDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

// --- CONFIGURACIÓN VISUAL ---
const SHIFT_STYLES: any = {
    // Turnos Operativos
    'M': 'bg-blue-100 text-blue-700 border-blue-200',
    'T': 'bg-orange-100 text-orange-700 border-orange-200',
    'N': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'D12': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'N12': 'bg-purple-100 text-purple-700 border-purple-200',
    'F': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'PU': 'bg-pink-100 text-pink-700 border-pink-200',
    
    // Novedades / Ausencias
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

    // --- ACCIONES ---

    const handleAssignShift = async (shiftConfig: any, positionName: string) => {
        if (!selectedCell || isProcessing) return;
        
        const [y, m, d] = selectedCell.dateStr.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const hoursToAdd = shiftConfig.hours || SHIFT_HOURS_LOOKUP[shiftConfig.code] || 8;

        const assignmentData = { shiftConfig, positionName, targetDate };

        if (shiftConfig.code !== 'F') {
            const warning = checkLaborRules(selectedCell.empId, targetDate, hoursToAdd);
            if (warning) {
                setAuthWarningMessage(warning);
                setPendingAssignment(assignmentData);
                return; 
            }
        }
        await executeAssignment(assignmentData, null);
    };

    const executeAssignment = async (data: any, overrideReason: string | null) => {
        setIsProcessing(true);
        const { shiftConfig, positionName, targetDate } = data;
        const [startH, startM] = (shiftConfig.startTime || '06:00').split(':').map(Number);
        const start = new Date(targetDate);
        start.setHours(startH, startM || 0, 0);
        
        const end = new Date(start);
        if (shiftConfig.code === 'F') end.setHours(23, 59, 59);
        else end.setTime(start.getTime() + ((shiftConfig.hours||8) * 3600000));

        const auth = getAuth();
        const u = auth.currentUser;
        const realUser = u?.displayName || u?.email || "Usuario Desconocido";

        const empName = employees.find(e => e.id === selectedCell.empId)?.name || 'Empleado';
        const clientObj = clients.find(c => c.id === selectedClient);
        const clientName = clientObj?.name || 'Cliente';
        const objName = clientObj?.objetivos?.find((o:any) => o.id === selectedObjective || o.name === selectedObjective)?.name || selectedObjective;

        try {
            if (selectedCell.currentShift?.id) await deleteDoc(doc(db, 'turnos', selectedCell.currentShift.id));
            
            await addDoc(collection(db, 'turnos'), {
                employeeId: selectedCell.empId, 
                clientId: selectedClient, 
                objectiveId: selectedObjective,
                code: shiftConfig.code, 
                type: shiftConfig.name, 
                position: positionName,
                startTime: Timestamp.fromDate(start), 
                endTime: Timestamp.fromDate(end), 
                isFranco: shiftConfig.code === 'F', 
                createdAt: serverTimestamp(),
                comments: overrideReason ? `Excepción por: ${realUser}` : `Asignado por: ${realUser}`
            });
            
            await addDoc(collection(db, 'audit_logs'), { 
                action: overrideReason ? 'AUTORIZACION_EXCEPCION' : 'ASIGNACION', 
                module: 'PLANIFICADOR', 
                details: overrideReason 
                    ? `⚠️ Autorizó excepción: ${authWarningMessage}. Turno: ${shiftConfig.code} a ${empName}`
                    : `Asignó ${shiftConfig.code} a ${empName} en ${clientName} - ${objName}`, 
                timestamp: serverTimestamp(), 
                actorName: realUser,
                actorUid: u?.uid || 'system'
            });
            
            toast.success('Asignado correctamente'); 
            setSelectedCell(null);
            setPendingAssignment(null); 
        } catch (e) { toast.error('Error al guardar'); } finally { setIsProcessing(false); }
    };

    const handleDelete = async () => {
        if (!selectedCell?.currentShift || isProcessing) return;
        if (!confirm('¿Borrar turno?')) return;
        setIsProcessing(true);
        
        const auth = getAuth();
        const u = auth.currentUser;
        const realUser = u?.displayName || u?.email || "Usuario Desconocido";
        
        const shiftData = selectedCell.currentShift;
        const empName = employees.find(e => e.id === selectedCell.empId)?.name || 'Empleado';

        try {
            await deleteDoc(doc(db, 'turnos', selectedCell.currentShift.id));
            
            await addDoc(collection(db, 'audit_logs'), { 
                action: 'ELIMINACION', 
                module: 'PLANIFICADOR', 
                details: `Borró turno ${shiftData.code} (${shiftData.type}) de ${empName} del día ${selectedCell.dateStr}`, 
                timestamp: serverTimestamp(), 
                actorName: realUser,
                actorUid: u?.uid || 'system'
            });
            
            toast.success('Borrado'); setSelectedCell(null);
        } catch(e) { toast.error('Error'); } finally { setIsProcessing(false); }
    };

    const handleAddToRoster = async (emp: any) => {
        if (!confirm(`¿Asignar a ${emp.name}?`)) return;
        try { await updateDoc(doc(db, 'empleados', emp.id), { preferredObjectiveId: selectedObjective }); toast.success('Agregado'); setShowAddModal(false); } catch(e) { toast.error('Error'); }
    };

    // ✅ DESASIGNAR DEL OBJETIVO
    const handleRemoveFromRoster = async (empId: string, empName: string) => {
        if(!confirm(`¿Quitar a ${empName} de este objetivo?\nEl empleado volverá a estar disponible para otros servicios.`)) return;
        try {
            await updateDoc(doc(db, 'empleados', empId), { preferredObjectiveId: '' });
            
            // Log auditoria
            const auth = getAuth();
            const u = auth.currentUser;
            const realUser = u?.displayName || u?.email || "Usuario Desconocido";
            await addDoc(collection(db, 'audit_logs'), { 
                action: 'DESVINCULACION_OBJETIVO', 
                module: 'PLANIFICADOR', 
                details: `Desvinculó a ${empName} del objetivo ${selectedObjective}`, 
                timestamp: serverTimestamp(), 
                actorName: realUser,
                actorUid: u?.uid || 'system'
            });

            toast.success('Desasignado correctamente');
        } catch(e) { toast.error('Error al desasignar'); }
    };

    const handleNotificationClick = async (notif: any) => {
        try {
            await updateDoc(doc(db, 'ausencias', notif.id), { viewed: true });
            toast.success('Notificación archivada');
        } catch(e) { console.error(e); }

        if (notif.employeeId) {
            const emp = employees.find(e => e.id === notif.employeeId);
            if(emp) setSearchTerm(emp.name);
            setForceShowAll(true);
            const [y, m, d] = notif.date.split('-').map(Number);
            setCurrentDate(new Date(y, m-1, 1));
            const key = `${notif.employeeId}_${notif.date}`;
            setHighlightKey(key);
            setTimeout(() => setHighlightKey(null), 3000);
        }
        setShowNotifications(false);
    };

    return (
        <DashboardLayout>
            <Head><title>Planificador</title></Head>
            <Toaster position="top-center" />
            <div className="flex flex-col h-[calc(100vh-100px)] p-2 space-y-4 animate-in fade-in">
                
                {/* HEADER */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border">
                        {/* ✅ LIMPIEZA DE FILTROS AL CAMBIAR SELECTS */}
                        <select value={selectedClient} onChange={e => {setSelectedClient(e.target.value); setSelectedObjective(''); setSearchTerm(''); setForceShowAll(false); }} className="bg-transparent text-xs font-bold w-32 outline-none">
                            <option value="">Cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={selectedObjective} onChange={e => { setSelectedObjective(e.target.value); setSearchTerm(''); setForceShowAll(false); }} className="bg-transparent text-xs font-bold w-32 outline-none" disabled={!selectedClient}>
                            <option value="">Objetivo...</option>
                            {clients.find(c => c.id === selectedClient)?.objetivos?.map((o:any) => <option key={o.id||o.name} value={o.id||o.name}>{o.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-1"><ChevronLeft size={16}/></button>
                        <span className="px-3 font-black text-xs w-24 text-center capitalize">{currentDate.toLocaleDateString('es-AR', {month:'long'})}</span>
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-1"><ChevronRight size={16}/></button>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <div className="relative">
                            <button onClick={() => {setShowNotifications(!showNotifications); setHasUnread(false)}} className="p-2 bg-white border rounded-full hover:bg-slate-50 text-slate-600 relative">
                                <Bell size={18}/>
                                {hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border overflow-hidden z-50 animate-in zoom-in-95">
                                    <div className="p-3 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-black text-xs uppercase text-slate-500">Alertas</h3><button onClick={() => setShowNotifications(false)}><X size={14}/></button></div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {notifications.length > 0 ? notifications.map((notif, i) => (
                                            <div key={i} className="p-3 border-b last:border-0 hover:bg-slate-50 flex gap-3 items-start">
                                                <div className="p-2 rounded-full bg-amber-100 text-amber-600"><CalendarX size={16}/></div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-slate-800">{notif.title}</p>
                                                    <p className="text-[10px] text-slate-500 leading-tight">{notif.msg}</p>
                                                    <p className="text-[9px] font-mono text-slate-400 mt-1">{notif.date}</p>
                                                    <button onClick={() => handleNotificationClick(notif)} className="mt-2 text-[10px] font-black text-indigo-600 uppercase hover:underline">Ver y Archivar</button>
                                                </div>
                                            </div>
                                        )) : <div className="p-6 text-center text-slate-400 text-xs">Sin novedades pendientes.</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="hidden md:flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100"><User size={12}/> <span className="text-[10px] font-black uppercase">{operatorName}</span></div>
                        
                        <button onClick={() => setShowAddModal(true)} disabled={!selectedObjective} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"><UserPlus size={14}/> Asignar</button>
                        <button onClick={() => setForceShowAll(!forceShowAll)} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-2 border ${forceShowAll ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white border-slate-200 text-slate-500'}`}>{forceShowAll ? <Eye size={14}/> : <EyeOff size={14}/>} {forceShowAll ? 'Ver Todos' : 'Dotación'}</button>
                    </div>
                </div>

                {/* GRID CON BUSCADOR MEJORADO */}
                {(!selectedObjective && !forceShowAll) ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed text-slate-400"><ShieldAlert size={48} className="mb-4 opacity-50"/><h3 className="text-lg font-black uppercase">Seleccione Objetivo</h3></div>
                ) : (
                    <div className="flex-1 bg-white rounded-2xl border shadow-xl overflow-hidden flex flex-col relative">
                        {/* BARRA DE BÚSQUEDA FLOTANTE DENTRO DE LA TABLA */}
                        <div className="sticky top-0 z-50 bg-white p-2 border-b flex gap-2">
                             <div className="relative w-64">
                                <Search className="absolute left-2 top-2 text-slate-400" size={16}/>
                                <input 
                                    className="w-full pl-8 pr-8 py-1.5 bg-slate-100 rounded-lg text-xs font-bold outline-none" 
                                    placeholder="Filtrar empleado..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                        <X size={14}/>
                                    </button>
                                )}
                             </div>
                        </div>

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
                                            {/* ✅ COLUMNA DE EMPLEADO CON BOTÓN DE DESVINCULAR */}
                                            <td className="sticky left-0 z-20 bg-white p-2 border-r border-b shadow-sm group-hover:bg-slate-50">
                                                <div className="flex justify-between items-center w-32">
                                                    <span className="text-[10px] font-bold truncate">{emp.name}</span>
                                                    {selectedObjective && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveFromRoster(emp.id, emp.name); }} 
                                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity p-1"
                                                            title="Desvincular del objetivo"
                                                        >
                                                            <UserMinus size={12}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {daysInMonth.map(day => {
                                                const key = `${emp.id}_${getDateKey(day)}`;
                                                const shift = shiftsMap[key];
                                                const absence = absencesMap[key];
                                                const isHighlighted = highlightKey === key;
                                                
                                                let cellContent = null;
                                                let cellClass = "hover:bg-slate-100";

                                                if (absence) {
                                                    const code = getAbsenceCode(absence.type);
                                                    cellClass = SHIFT_STYLES[code] || SHIFT_STYLES['Ausencia con Aviso'];
                                                    cellContent = (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-black">{code}</span>
                                                        </div>
                                                    );
                                                } else if (shift) {
                                                    const label = shift.code || shift.type || '?';
                                                    const style = getDefaultStyle(label);
                                                    cellClass = `${style} shadow-sm border`;
                                                    cellContent = (
                                                        <div className="flex flex-col items-center">
                                                            <span>{label}</span>
                                                            {shift.position && <span className="text-[6px] opacity-70">{shift.position.substring(0,2).toUpperCase()}</span>}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <td key={key} onClick={() => setSelectedCell({ empId: emp.id, dateStr: getDateKey(day), currentShift: shift, absence: absence })} className={`border-b border-r p-0.5 cursor-pointer text-center relative ${isHighlighted ? 'bg-indigo-100' : ''}`}>
                                                        <div className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-black ${cellClass} ${isHighlighted ? 'ring-4 ring-indigo-500 animate-pulse z-50' : ''}`}>
                                                            {cellContent}
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

                {/* NOVEDADES UNIFICADAS */}
                <div className="bg-white p-2 rounded-xl border shadow-sm shrink-0 h-32 overflow-hidden flex flex-col">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 border-b pb-1 flex items-center gap-2"><Clock size={12}/> Últimas Novedades</h4>
                    <div className="overflow-y-auto custom-scrollbar space-y-1 px-2 pb-2">
                        {unifiedLogs.map(log => {
                            const isAlert = log.source === 'AUSENCIA';
                            const actorKey = typeof log.actor === 'string' ? log.actor : 'Sistema';
                            const realActor = usersMap[actorKey] || actorKey || 'Sistema';
                            
                            return (
                                <div key={log.id} className={`flex items-center gap-2 text-[10px] p-1 border-b last:border-0 hover:bg-slate-50 ${isAlert ? 'bg-amber-50/50' : ''}`}>
                                    <span className="font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    <span className={`font-bold px-1.5 rounded uppercase ${isAlert ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{log.label}</span>
                                    <span className="text-slate-600 truncate flex-1">{log.detail}</span>
                                    <span className="text-[9px] text-slate-400 flex items-center gap-1 bg-slate-100 px-2 rounded-full border"><User size={8}/> {realActor}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MODAL DE DETALLE / ACCIONES */}
            {selectedCell && !pendingAssignment && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
                            <div><h3 className="font-black text-lg uppercase">{employees.find(e=>e.id===selectedCell.empId)?.name}</h3><p className="text-xs text-slate-500 font-bold">{selectedCell.dateStr}</p></div>
                            <button onClick={() => setSelectedCell(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={16}/></button>
                        </div>

                        {selectedCell.absence && (
                            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl mb-4">
                                <h4 className="font-black text-amber-700 uppercase text-xs flex items-center gap-2"><Stethoscope size={14}/> {selectedCell.absence.type}</h4>
                                <p className="text-xs text-amber-800 mt-1">{selectedCell.absence.reason}</p>
                                <p className="text-[10px] text-amber-600 mt-2 font-bold">Estado: {selectedCell.absence.status}</p>
                            </div>
                        )}

                        {selectedCell.currentShift ? (
                            <div className="space-y-3">
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase">Turno Actual</p>
                                    <p className="text-3xl font-black text-indigo-700 mt-1">{selectedCell.currentShift.code}</p>
                                    {selectedCell.currentShift.position && <p className="text-xs font-bold text-indigo-500 mt-1">{selectedCell.currentShift.position}</p>}
                                </div>
                                <button onClick={handleDelete} disabled={isProcessing} className="w-full py-4 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors disabled:opacity-50">
                                    {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><Trash2 size={16}/> Eliminar Turno</>}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {positionStructure.map((pos, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1"><Layers size={10}/> {pos.positionName}</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {pos.shifts.map((conf: any) => (
                                                <button key={conf.code} onClick={() => handleAssignShift(conf, pos.positionName)} disabled={isProcessing} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 hover:brightness-95 transition-all disabled:opacity-50 ${getDefaultStyle(conf.code)}`}>
                                                    <span className="font-black text-sm">{conf.code}</span>
                                                    <span className="text-[8px] opacity-70">{conf.startTime?.substring(0,5)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t">
                                    <button onClick={() => handleAssignShift({code:'F', name:'Franco', startTime:'00:00'}, 'General')} disabled={isProcessing} className="w-full p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 font-black text-sm hover:brightness-95 disabled:opacity-50">
                                        {isProcessing ? 'PROCESANDO...' : 'ASIGNAR FRANCO'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ MODAL DE AUTORIZACIÓN (EXCEPCIÓN) */}
            {pendingAssignment && (
                <div className="fixed inset-0 z-[200] bg-rose-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl text-center border-4 border-rose-500 relative">
                        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600">
                            <ShieldAlert size={40}/>
                        </div>
                        
                        <h3 className="text-2xl font-black uppercase text-rose-600 mb-2">¡Alto! Regla Rota</h3>
                        <div className="bg-rose-50 p-4 rounded-xl text-left border border-rose-100 mb-6">
                            <p className="text-xs font-bold text-rose-800 whitespace-pre-wrap">{authWarningMessage}</p>
                        </div>

                        <div className="mb-6 text-xs text-slate-400 font-bold uppercase">
                            <p>Autoriza:</p>
                            <div className="flex items-center justify-center gap-2 mt-1 bg-slate-100 py-2 rounded-lg">
                                <ShieldCheck size={14} className="text-emerald-500"/> {operatorName}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPendingAssignment(null)} className="py-4 bg-slate-100 rounded-2xl font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                            <button onClick={() => executeAssignment(pendingAssignment, "Forzado por " + operatorName)} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-rose-700 shadow-xl shadow-rose-500/30">Autorizar Excepción</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-black text-sm uppercase">Agregar a Dotación</h3><button onClick={() => setShowAddModal(false)}><X size={18}/></button></div>
                        <div className="p-3 border-b"><input autoFocus type="text" placeholder="Buscar empleado..." className="w-full bg-slate-100 p-2 rounded-lg text-xs font-bold outline-none" onChange={e => setAddSearchTerm(e.target.value)} /></div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {availableToAdd.map(emp => (
                                <div key={emp.id} className="flex justify-between items-center p-3 hover:bg-indigo-50 rounded-lg group cursor-pointer border border-transparent hover:border-indigo-100" onClick={() => handleAddToRoster(emp)}>
                                    <span className="text-xs font-bold">{emp.name}</span><ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600"/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}