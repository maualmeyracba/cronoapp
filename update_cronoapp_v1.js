const fs = require('fs');
const path = require('path');

console.log(`\n🧬 CRONO V31.0: FIX CRÍTICO DE HIDRATACIÓN (HOOK)`);
console.log(`1. HOOK: Inicialización de estado 'operatorInfo' segura (sin new Date() en render).`);
console.log(`2. HOOK: Tipado explícito para evitar errores de sintaxis.`);

const BASE_SRC = path.join('apps', 'web2', 'src');
const DIR_HOOKS = path.join(BASE_SRC, 'hooks');

// =============================================================================
// 1. HOOK (FIX HIDRATACIÓN)
// =============================================================================
const HOOK_CONTENT = `
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';

const getSafeDate = (val: any) => {
    if (!val) return null;
    try {
        if (val.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (val.seconds) return new Date(val.seconds * 1000);
        return new Date(val);
    } catch (e) { return null; }
};

const formatName = (input: any) => {
    if (!input) return 'Operador';
    if (input.displayName) return input.displayName;
    if (input.email) return input.email.split('@')[0];
    return 'Operador';
};

export const useOperacionesMonitor = () => {
    const [now, setNow] = useState(new Date()); // 'now' se actualiza en useEffect, no rompe hidratación si no se renderiza directo
    const [rawShifts, setRawShifts] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [objectives, setObjectives] = useState<any[]>([]);
    const [servicesSLA, setServicesSLA] = useState<any[]>([]);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);

    const [viewTab, setViewTab] = useState<'TODOS' | 'PRIORIDAD' | 'RETENIDOS' | 'PLANIFICADO' | 'ACTIVOS' | 'AUSENTES' | 'HOY'>('TODOS');
    
    // FILTRO DE CLIENTE
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    const [filterText, setFilterText] = useState('');
    const [isCompact, setIsCompact] = useState(false);
    const [modals, setModals] = useState({ checkout: false, novedad: false });
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [novedadData, setNovedadData] = useState({ tipo: 'Llegada Tarde', nota: '' });
    
    // 🛑 FIX V31: INICIALIZACIÓN SEGURA (startTime: null) PARA EVITAR ERROR DE HIDRATACIÓN
    const [operatorInfo, setOperatorInfo] = useState<{ name: string; startTime: Date | null }>({ 
        name: 'Cargando...', 
        startTime: null 
    });
    
    const servicesSLARef = useRef<any[]>([]);

    // Reloj (Solo cliente)
    useEffect(() => { 
        setNow(new Date()); // Sincronizar al montar
        const t = setInterval(() => setNow(new Date()), 30000); 
        return () => clearInterval(t); 
    }, []);

    // CARGA DE DATOS
    useEffect(() => {
        const auth = getAuth();
        // 🛑 FIX V31: ASIGNAR FECHA SOLO EN EL CLIENTE
        if (auth.currentUser) {
            setOperatorInfo({ name: formatName(auth.currentUser), startTime: new Date() });
        } else {
            setOperatorInfo({ name: 'Operador', startTime: new Date() });
        }

        const unsubEmp = onSnapshot(collection(db, 'empleados'), snap => setEmployees(snap.docs.map(d => ({ id: d.id, fullName: \`\${d.data().lastName || ''} \${d.data().firstName || ''}\`.trim(), ...d.data() }))));
        
        const unsubObj = onSnapshot(collection(db, 'clients'), snap => {
            const objs: any[] = [];
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.objetivos) data.objetivos.forEach((o: any) => objs.push({ ...o, clientName: data.name, clientId: d.id }));
                else objs.push({ id: d.id, name: data.name, clientName: data.name });
            });
            setObjectives(objs);
        });

        const unsubSLA = onSnapshot(query(collection(db, 'servicios_sla'), where('status', '==', 'active')), snap => { const services = snap.docs.map(d => ({ id: d.id, ...d.data() })); setServicesSLA(services); servicesSLARef.current = services; });
        const start = new Date(); start.setHours(0,0,0,0);
        const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), where('timestamp', '>=', Timestamp.fromDate(start)), orderBy('timestamp', 'desc'), limit(50)), snap => { setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data(), formattedActor: d.data().actorName, time: getSafeDate(d.data().timestamp), fullDetail: d.data().details }))); });
        return () => { unsubEmp(); unsubObj(); unsubSLA(); unsubLogs(); };
    }, []);

    useEffect(() => {
        const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 1); 
        const end = new Date(); end.setHours(23,59,59,999); end.setDate(end.getDate() + 1);
        return onSnapshot(query(collection(db, 'turnos'), where('startTime', '>=', Timestamp.fromDate(start)), where('startTime', '<=', Timestamp.fromDate(end))), (snap) => {
            setRawShifts(snap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, shiftDateObj: getSafeDate(data.startTime), endDateObj: getSafeDate(data.endTime) }; }));
        });
    }, []);

    // LISTA DE CLIENTES ÚNICOS
    const uniqueClients = useMemo(() => {
        const map = new Map();
        objectives.forEach(obj => {
            if (obj.clientId && obj.clientName) {
                map.set(obj.clientId, obj.clientName);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [objectives]);

    // OBJETIVOS FILTRADOS
    const filteredObjectives = useMemo(() => {
        if (!selectedClientId) return objectives;
        return objectives.filter(o => o.clientId === selectedClientId);
    }, [objectives, selectedClientId]);

    const processedData = useMemo(() => {
        const mappedShifts = rawShifts.map(shift => {
            if (!shift.shiftDateObj) return null;
            const typeUpper = (shift.type || '').toUpperCase();
            if (['FRANCO', 'OFF', 'DESCANSO'].some(s => typeUpper.includes(s))) return null;

            const isReported = shift.status === 'UNCOVERED_REPORTED' || shift.reportedToPlanning === true; 
            const isCompleted = shift.status === 'COMPLETED' || !!shift.isCompleted;
            const isPresent = shift.status === 'PRESENT' || shift.status === 'CHECK_IN' || !!shift.isPresent;
            const isRetention = !!shift.isRetention;
            const isAbsent = shift.status === 'ABSENT' || !!shift.isAbsent;
            const nameUpper = (shift.employeeName || '').toUpperCase();
            const idUpper = (shift.employeeId || '').toUpperCase();
            const isUnassigned = !shift.employeeId || idUpper === 'VACANTE' || idUpper === '' || nameUpper.includes('FALTANTE') || nameUpper.includes('VACANTE');
            const diffMinutes = (now.getTime() - shift.shiftDateObj.getTime()) / 60000;
            const isLate = !isPresent && !isCompleted && !isUnassigned && !isAbsent && diffMinutes > 15;
            const isCriticallyLate = isLate && diffMinutes > 60;
            const isFuture = diffMinutes < 0;
            const isPending = !isPresent && !isCompleted && !isAbsent && !isUnassigned && !isLate && !isReported;

            let statusText = 'PLANIFICADO';
            if (isReported) statusText = 'REPORTADO'; else if (isAbsent) statusText = 'AUSENTE'; else if (isUnassigned) statusText = 'VACANTE'; else if (isRetention) statusText = 'RETENIDO'; else if (isPresent) statusText = 'EN SERVICIO'; else if (isCompleted) statusText = 'FINALIZADO'; else if (isLate) statusText = 'LLEGADA TARDE';

            return {
                ...shift, isUnassigned, isRetention, isReported, isPresent, isCompleted, statusText, isLate, isCriticallyLate, isAbsent, isFuture, isPending,
                hasPendingIssue: (!isCompleted && !isReported && !isAbsent && (isRetention || isUnassigned || isLate))
            };
        }).filter(Boolean);

        const slaGaps: any[] = [];
        const todayStr = now.toDateString();
        servicesSLA.forEach(service => {
            const objectiveId = service.objectiveId;
            const positions = service.positions || [];
            const shiftsForObjective = mappedShifts.filter(s => (s.objectiveId === objectiveId) && s.shiftDateObj?.toDateString() === todayStr);
            positions.forEach((pos: any) => {
                const qty = parseInt(pos.quantity || '1', 10);
                const is24Hs = (pos.coverageType || '').toLowerCase().includes('24hs') || (pos.M && pos.T && pos.N);
                const auditSlots = is24Hs ? [{code:'M',s:7,l:'MAÑANA (07:00)'}, {code:'T',s:15,l:'TARDE (15:00)'}, {code:'N',s:23,l:'NOCHE (23:00)'}] : [{code:'G',s:8,l:'GENERAL (08:00)'}];
                auditSlots.forEach(slot => {
                    if (now.getHours() >= slot.s) {
                        const foundCount = shiftsForObjective.filter(s => { const h = s.shiftDateObj.getHours(); return Math.abs(h - slot.s) <= 3 && (s.positionId === pos.id || s.positionName === pos.name); }).length;
                        if (qty - foundCount > 0) {
                             for (let i = 0; i < (qty - foundCount); i++) {
                                const gapDate = new Date(now); gapDate.setHours(slot.s, 0, 0, 0);
                                slaGaps.push({
                                    id: \`SLA_GAP_\${service.id}_\${pos.id}_\${slot.code}_\${i}\`, employeeName: \`FALTANTE \${slot.l}\`, clientName: service.clientName, objectiveName: service.objectiveName, positionName: pos.name, shiftDateObj: gapDate, endDateObj: new Date(gapDate.getTime() + 8*3600000), hasPendingIssue: true, isSlaGap: true, isUnassigned: true, statusText: 'VACANTE CONTRATO', objectiveId: objectiveId, positionId: pos.id, clientId: service.clientId
                                });
                            }
                        }
                    }
                });
            });
        });
        return [...mappedShifts, ...slaGaps].sort((a:any, b:any) => a.shiftDateObj - b.shiftDateObj);
    }, [rawShifts, now, servicesSLA]);

    const listData = useMemo(() => {
        let list = processedData;
        
        if (selectedClientId) {
            list = list.filter((s:any) => s.clientId === selectedClientId);
        }

        if (filterText) { const lower = filterText.toLowerCase(); list = list.filter((s: any) => (s.employeeName||'').toLowerCase().includes(lower) || (s.clientName||'').toLowerCase().includes(lower) || (s.objectiveName||'').toLowerCase().includes(lower)); }
        
        const isStrictlyToday = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

        switch (viewTab) {
            case 'TODOS': 
                return list.filter((s:any) => {
                    if (s.isReported) return false;
                    const dateOk = isStrictlyToday(s.shiftDateObj);
                    const isCriticalBacklog = s.shiftDateObj < new Date(now.setHours(0,0,0,0)) && (s.hasPendingIssue || s.isUnassigned);
                    return dateOk || isCriticalBacklog;
                });
            case 'PRIORIDAD': return list.filter((s:any) => (s.hasPendingIssue || s.isSlaGap) && !s.isReported && !s.isPresent && !s.isAbsent);
            case 'RETENIDOS': return list.filter((s:any) => s.isRetention && !s.isCompleted);
            case 'PLANIFICADO': return list.filter((s:any) => isStrictlyToday(s.shiftDateObj) && (s.isFuture || s.isPending) && !s.isUnassigned && !s.isPresent && !s.isAbsent && !s.isCompleted && !s.isReported);
            case 'ACTIVOS': return list.filter((s:any) => s.isPresent && !s.isCompleted);
            case 'AUSENTES': return list.filter((s:any) => s.isAbsent && !s.isReported);
            case 'HOY': return list.filter((s:any) => isStrictlyToday(s.shiftDateObj));
            default: return list;
        }
    }, [processedData, viewTab, filterText, now, selectedClientId]);

    const stats = useMemo(() => ({
        prioridad: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true) && (s.hasPendingIssue || s.isSlaGap) && !s.isReported && !s.isPresent && !s.isAbsent).length,
        retenidos: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true) && s.isRetention && !s.isCompleted).length,
        activos: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true) && s.isPresent && !s.isCompleted).length,
        planificado: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true) && (s.isFuture || s.isPending) && !s.isUnassigned && !s.isPresent).length,
        ausentes: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true) && s.isAbsent && !s.isReported).length,
        total: processedData.filter(s => (selectedClientId ? s.clientId === selectedClientId : true)).length
    }), [processedData, selectedClientId]);

    const handleAction = async (action: string, shiftId: string, payload?: any) => {
        if (shiftId.startsWith('SLA_GAP')) { toast.error("Use RESOLVER"); return; }
        try {
            const docRef = doc(db, 'turnos', shiftId);
            if (action === 'CHECKIN') await updateDoc(docRef, { status: 'PRESENT', isPresent: true, realStartTime: serverTimestamp(), isLate: false });
            else if (action === 'CHECKOUT') await updateDoc(docRef, { status: 'COMPLETED', isCompleted: true, isPresent: false, realEndTime: serverTimestamp(), checkoutNote: payload || null, hasNovedad: !!payload });
            else if (action === 'NOVEDAD') { setModals(m => ({...m, novedad: true})); setProcessingId(shiftId); }
        } catch (e:any) { toast.error("Error: " + e.message); }
    };

    return { 
        now, processedData, listData, stats, recentLogs, objectives, servicesSLA, 
        viewTab, setViewTab, filterText, setFilterText, isCompact, setIsCompact, 
        modals, setModals, handleAction, processingId, confirmNovedad: async()=>{}, 
        novedadData, setNovedadData, operatorInfo, formatName,
        selectedClientId, setSelectedClientId, uniqueClients, filteredObjectives 
    };
};
`;

try {
    fs.writeFileSync(path.join(DIR_HOOKS, 'useOperacionesMonitor.ts'), HOOK_CONTENT);
    console.log("✅ FIX V31.0: Hook reparado. Inicialización segura para prevenir error de hidratación.");
} catch (e) {
    console.error("❌ Error escribiendo hook:", e);
}