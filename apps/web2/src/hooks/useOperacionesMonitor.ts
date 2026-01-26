
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, limit, Timestamp, doc, updateDoc, serverTimestamp, getDocs, addDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth'; 
import { toast } from 'sonner';

const getSafeDate = (val: any) => {
    if (!val) return null;
    try {
        if (val.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (val.seconds) return new Date(val.seconds * 1000);
        if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    } catch (e) { }
    return null;
};

const formatName = (input: any) => {
    if (!input) return 'Operador';
    try {
        if (typeof input === 'object') {
            if (input.displayName && input.displayName.length > 1) return input.displayName;
            if (input.email) return input.email.split('@')[0].replace(/[0-9._-]/g, ' ').split(' ').map((n:any)=>n.charAt(0).toUpperCase()+n.slice(1).toLowerCase()).join(' ').trim();
        }
        if (typeof input === 'string' && input.includes('@')) return input.split('@')[0].replace(/[0-9._-]/g, ' ').split(' ').map((n:any)=>n.charAt(0).toUpperCase()+n.slice(1).toLowerCase()).join(' ').trim();
        if (typeof input === 'string') return input;
    } catch (e) {}
    return 'Operador';
};

export const useOperacionesMonitor = () => {
    const [now, setNow] = useState(new Date());
    const [rawShifts, setRawShifts] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [objectives, setObjectives] = useState<any[]>([]); 
    const [servicesSLA, setServicesSLA] = useState<any[]>([]); 
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [config, setConfig] = useState({ toleranceLate: 15, toleranceAbsent: 60, toleranceRetention: 15 });
    const [operatorInfo, setOperatorInfo] = useState({ name: '', startTime: new Date() });
    
    const [viewTab, setViewTab] = useState<'PRIORIDAD' | 'RETENIDOS' | 'AUN_NO' | 'ACTIVOS' | 'AUSENTES' | 'PLANIFICADO' | 'HOY'>('PRIORIDAD');
    const [filterText, setFilterText] = useState('');
    const [isCompact, setIsCompact] = useState(false);
    const [modals, setModals] = useState({ checkout: false, novedad: false, coverage: false });
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [novedadData, setNovedadData] = useState({ tipo: 'Llegada Tarde', nota: '' });

    const servicesSLARef = useRef<any[]>([]);
    const processedDataRef = useRef<any[]>([]);
    const objectivesRef = useRef<any[]>([]); 

    useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
    useEffect(() => { const auth = getAuth(); const unsubscribe = auth.onAuthStateChanged(user => { if (user) setOperatorInfo(prev => ({ ...prev, name: formatName(user) })); }); return () => unsubscribe(); }, []);

    // CARGA DE DATOS
    useEffect(() => {
        const start = new Date(); start.setHours(0,0,0,0);
        const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), where('timestamp', '>=', Timestamp.fromDate(start)), limit(100)), snap => {
             const logs = snap.docs.map(d => ({ id: d.id, ...d.data(), time: getSafeDate(d.data().timestamp), formattedActor: formatName(d.data().actorName || d.data().actor || 'Sistema'), fullDetail: d.data().details || d.data().notes || '-' }));
             setRecentLogs(logs.sort((a: any,b: any) => b.time - a.time));
        });
        const fetchConfig = async () => { try { const snap = await getDocs(query(collection(db, 'config'), limit(1))); if (!snap.empty) setConfig({ ...config, ...snap.docs[0].data() }); } catch (e) {} }; fetchConfig();
        const unsubEmp = onSnapshot(collection(db, 'empleados'), snap => setEmployees(snap.docs.map(d => ({ id: d.id, fullName: `${d.data().lastName||''} ${d.data().firstName||''}`.trim() || d.data().name || 'Sin Nombre', ...d.data() }))));
        const unsubObj = onSnapshot(collection(db, 'clients'), snap => { 
            const objs: any[] = []; 
            snap.docs.forEach(d => { const data = d.data(); if (data.objetivos) { data.objetivos.forEach((o: any) => { objs.push({ ...o, clientName: data.name, clientId: d.id }); }); } else { objs.push({ id: d.id, name: data.name, clientName: data.name }); }}); 
            setObjectives(objs); 
            objectivesRef.current = objs;
        });
        const unsubSLA = onSnapshot(query(collection(db, 'servicios_sla'), where('status', '==', 'active')), snap => {
            const services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setServicesSLA(services);
            servicesSLARef.current = services; 
        });
        return () => { unsubLogs(); unsubEmp(); unsubObj(); unsubSLA(); };
    }, []);

    useEffect(() => {
        const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 1); 
        const end = new Date(); end.setHours(23,59,59,999); end.setDate(end.getDate() + 1);
        return onSnapshot(query(collection(db, 'turnos'), where('startTime', '>=', Timestamp.fromDate(start)), where('startTime', '<=', Timestamp.fromDate(end))), (snap) => {
            setRawShifts(snap.docs.map(d => {
                const data = d.data();
                const startObj = getSafeDate(data.startTime);
                const endObj = getSafeDate(data.endTime) || new Date(startObj.getTime() + (8 * 3600000));
                return { id: d.id, ...data, shiftDateObj: startObj, endDateObj: endObj, visualEndDateObj: endObj };
            }));
        });
    }, []);

    // PROCESAMIENTO
    const processedData = useMemo(() => {
        const mappedShifts = rawShifts.map(shift => {
            if (!shift.shiftDateObj) return null;
            
            // ESTADOS BASE
            const isReported = shift.status === 'UNCOVERED_REPORTED' || shift.reportedToPlanning === true; 
            const isCompleted = shift.status === 'COMPLETED' || !!shift.isCompleted;
            const isPresent = shift.status === 'PRESENT' || shift.status === 'CHECK_IN' || !!shift.isPresent;
            const isRetention = !!shift.isRetention;
            const isUnassigned = !shift.employeeId || shift.employeeId === 'VACANTE';
            
            // LOGICA TEMPORAL (Reloj)
            const diffMinutes = (now.getTime() - shift.shiftDateObj.getTime()) / 60000;
            // Es tarde si: No está presente, no terminó, y ya pasó la hora de inicio + tolerancia
            const isLate = !isPresent && !isCompleted && diffMinutes > config.toleranceLate;
            const isCriticallyLate = !isPresent && !isCompleted && diffMinutes > config.toleranceAbsent;
            const isAbsent = shift.status === 'ABSENT' || !!shift.isAbsent;

            let statusText = 'PLANIFICADO';
            if (isReported) statusText = 'EN PLANIFICACIÓN'; 
            else if (isUnassigned) statusText = 'VACANTE'; 
            else if (isRetention) statusText = 'RETENIDO'; 
            else if (isPresent) statusText = 'EN SERVICIO'; 
            else if (isCompleted) statusText = 'FINALIZADO';
            else if (isLate) statusText = 'LLEGADA TARDE';

            const objective = objectives.find(o => o.id === shift.objectiveId || o.name === shift.objectiveName);
            
            // RECUPERACIÓN DE NOMBRE DE PUESTO (V7.55)
            let finalPositionName = shift.positionName || shift.position || 'Puesto General';
            const service = servicesSLA.find(s => s.objectiveId === shift.objectiveId);
            if (service && service.positions) {
                const pos = service.positions.find((p:any) => p.id === shift.positionId);
                if (pos && pos.name) finalPositionName = pos.name;
                else if (service.positions.length === 1 && service.positions[0].name) finalPositionName = service.positions[0].name;
            }

            // RECUPERACIÓN DE NOMBRE DE EMPLEADO (V7.55)
            // Prioridad: 1. Nombre en turno, 2. Búsqueda por ID en empleados, 3. 'VACANTE' o 'Sin Nombre'
            let finalEmployeeName = shift.employeeName;
            if (!finalEmployeeName && shift.employeeId && shift.employeeId !== 'VACANTE') {
                 const emp = employees.find(e => e.id === shift.employeeId);
                 if (emp) finalEmployeeName = emp.fullName;
            }
            if (isUnassigned) finalEmployeeName = 'VACANTE';
            if (!finalEmployeeName) finalEmployeeName = 'Sin Asignar';

            return {
                ...shift, 
                clientName: objective?.clientName || shift.clientName,
                objectiveName: objective?.name || shift.objectiveName,
                positionName: finalPositionName,
                employeeName: finalEmployeeName,
                isUnassigned, isRetention, isReported, isPresent, isCompleted, statusText,
                isLate, isCriticallyLate, isAbsent,
                // Flag para identificar problemas operativos
                hasPendingIssue: (!isCompleted && !isReported && (isRetention || isUnassigned || isLate))
            };
        }).filter(Boolean);

        const slaGaps: any[] = [];
        const todayStr = now.toDateString();
        servicesSLA.forEach(service => {
            const objectiveId = service.objectiveId;
            const positions = service.positions || [];
            const objInfo = objectives.find(o => o.id === objectiveId) || { name: service.objectiveName || 'Objetivo', clientName: service.clientName || 'Cliente' };
            const shiftsForObjective = mappedShifts.filter(s => (s.objectiveId === objectiveId) && s.shiftDateObj?.toDateString() === todayStr);
            
            positions.forEach((pos: any) => {
                const qty = parseInt(pos.quantity || '1', 10);
                const is24Hs = (pos.coverageType || '').toLowerCase().includes('24hs') || (pos.M && pos.T && pos.N);
                const posNameUpper = (pos.name || '').toUpperCase();
                const shiftsForPos = shiftsForObjective.filter(s => s.positionId === pos.id || (s.positionName || '').toUpperCase() === posNameUpper);
                let realPositionName = pos.name || 'Guardia';

                const auditSlots = [];
                if (is24Hs) { auditSlots.push({ code: 'M', start: 5, end: 12, label: 'TURNO MAÑANA' }); auditSlots.push({ code: 'T', start: 13, end: 20, label: 'TURNO TARDE' }); auditSlots.push({ code: 'N', start: 21, end: 29, label: 'TURNO NOCHE' }); } 
                else { auditSlots.push({ code: 'G', start: 0, end: 24, label: 'TURNO GENERAL' }); }
                
                auditSlots.forEach(slot => {
                    const foundCount = shiftsForPos.filter(s => { const h = s.shiftDateObj.getHours(); return h >= slot.start && h <= slot.end; }).length;
                    const missing = qty - foundCount;
                    if (missing > 0) {
                         for (let i = 0; i < missing; i++) {
                            const gapDate = new Date(now); gapDate.setHours(slot.start === 0 ? 9 : (slot.start === 5 ? 7 : (slot.start === 13 ? 15 : 23)), 0, 0, 0);
                            slaGaps.push({
                                id: `SLA_GAP_${service.id}_${pos.id}_${slot.code}_${i}`,
                                employeeName: `FALTANTE ${slot.label}`, 
                                clientName: objInfo.clientName, objectiveName: objInfo.name, positionName: realPositionName,
                                shiftDateObj: gapDate, endDateObj: new Date(gapDate.getTime() + 8*3600000), 
                                hasPendingIssue: true, isSlaGap: true, statusText: 'VACANTE DE CONTRATO',
                                objectiveId: objectiveId, positionId: pos.id, clientId: service.clientId
                            });
                        }
                    }
                });
            });
        });
        const result = [...mappedShifts, ...slaGaps].sort((a:any, b:any) => a.shiftDateObj - b.shiftDateObj);
        processedDataRef.current = result;
        return result;
    }, [rawShifts, now, employees, objectives, servicesSLA, config]);

    const stats = useMemo(() => ({
        total: processedData.filter((s:any) => s.isCompleted).length,
        prioridad: processedData.filter(s => (s.hasPendingIssue || s.isSlaGap) && !s.isReported).length,
        retenidos: processedData.filter(s => s.isRetention).length,
        aunNo: processedData.filter(s => !s.isLate && !s.isPresent && !s.isAbsent && !s.isCompleted && !s.isRetention).length,
        activos: processedData.filter(s => s.isPresent && !s.isCompleted && !s.isRetention).length,
        ausentes: processedData.filter(s => s.isAbsent).length,
        planificado: processedData.filter(s => s.shiftDateObj > now && !s.isUnassigned && !s.isCompleted && !s.isSlaGap).length
    }), [processedData, now]);

    const listData = useMemo(() => {
        let list = processedData;
        if (filterText) { const lower = filterText.toLowerCase(); list = list.filter((s: any) => (s.employeeName||'').toLowerCase().includes(lower) || (s.clientName||'').toLowerCase().includes(lower)); }
        
        switch (viewTab) {
            case 'PRIORIDAD': 
                // V7.55: Todo lo que esté "mal" ahora. Tarde, Vacante, Retenido.
                return list.filter((s:any) => (s.hasPendingIssue || s.isSlaGap) && !s.isReported && !s.isPresent);
            
            case 'RETENIDOS': return list.filter((s:any) => s.isRetention);
            
            case 'AUN_NO': 
                // V7.55: SOLO FUTURO. Si ya pasó la hora, se va a Prioridad.
                return list.filter((s:any) => s.shiftDateObj > now && !s.isPresent && !s.isCompleted && !s.isRetention && !s.isSlaGap && !s.isReported);
                
            case 'ACTIVOS': return list.filter((s:any) => s.isPresent && !s.isCompleted && !s.isRetention);
            case 'AUSENTES': return list.filter((s:any) => s.isAbsent);
            case 'PLANIFICADO': return list.filter((s:any) => s.shiftDateObj > now && !s.isUnassigned && !s.isCompleted && !s.isAbsent && !s.isSlaGap && !s.isReported);
            case 'HOY': return list.filter((s:any) => s.isCompleted || s.isReported || s.isResolved);
            default: return list;
        }
    }, [processedData, viewTab, filterText, now]);

    const handleAction = async (action: string, shiftId: string, payload?: any) => {
        if (action === 'NOTIFY_GAP') {
            setProcessingId(shiftId); setNovedadData({ tipo: 'Falta de Cobertura (Notificar)', nota: 'Reportado desde panel de resolución' });
            confirmNovedad(shiftId, 'Falta de Cobertura (Notificar)'); return;
        }
        if (shiftId.startsWith('SLA_GAP_')) { toast.error("Para un faltante de SLA, use 'RESOLVER' o 'NOTIFICAR'."); return; }
        const shift = rawShifts.find(s => s.id === shiftId);
        if (!shift) return;
        setProcessingId(shiftId);
        const auth = getAuth(); const user = auth.currentUser; const actorName = formatName(user);

        try {
            if (action === 'CHECKIN') {
                // --- V7.55: INGRESO DIRECTO SIN PREGUNTAS ---
                // Se registra la hora real. El cálculo de retención es post-proceso de RRHH.
                await updateDoc(doc(db, 'turnos', shiftId), { status: 'PRESENT', isPresent: true, realStartTime: serverTimestamp(), checkInMethod: 'MANUAL_DASHBOARD' });
                await addDoc(collection(db, 'audit_logs'), { action: 'MANUAL_CHECKIN', targetShiftId: shiftId, actorName: actorName, timestamp: serverTimestamp(), details: 'Ingreso manual' });
                toast.success("Ingreso registrado");
            } else if (action === 'CHECKOUT') {
                await updateDoc(doc(db, 'turnos', shiftId), { status: 'COMPLETED', isCompleted: true, isPresent: false, realEndTime: serverTimestamp(), checkoutNote: payload || null });
                await addDoc(collection(db, 'audit_logs'), { action: 'MANUAL_CHECKOUT', targetShiftId: shiftId, actorName: actorName, timestamp: serverTimestamp(), details: payload ? `Salida: ${payload}` : 'Salida normal' });
                toast.success("Salida registrada");
            } else if (action === 'NOVEDAD') {
                setModals(m => ({ ...m, novedad: true }));
            }
        } catch (e) { toast.error("Error en acción"); }
        setProcessingId(null);
    };

    const confirmNovedad = async (forceId?: string, forceType?: string) => {
        const targetId = forceId || processingId;
        const targetType = forceType || novedadData.tipo;
        if (!targetId) return;
        const auth = getAuth(); const user = auth.currentUser; const actorName = formatName(user);
        try {
            const isGap = targetId.startsWith('SLA_GAP_');
            if (targetType.includes('Notificar')) {
                let targetPositionName = 'Guardia'; let objectiveId = null; let clientId = null; let startTime = new Date(); let clientName = 'Cliente'; let objectiveName = 'Objetivo'; let shiftType = 'Mañana';
                if (isGap) {
                    const parts = targetId.split('_');
                    if (parts.length >= 4) {
                        const serviceId = parts[2]; const posId = parts[3];
                        if (parts.length >= 5) {
                            const slotCode = parts[4]; const derivedDate = new Date(); 
                            if (slotCode === 'M') { derivedDate.setHours(7,0,0,0); shiftType = 'Mañana'; } else if (slotCode === 'T') { derivedDate.setHours(15,0,0,0); shiftType = 'Tarde'; } else if (slotCode === 'N') { derivedDate.setHours(23,0,0,0); shiftType = 'Noche'; }
                            startTime = derivedDate;
                        }
                        const service = servicesSLARef.current.find(s => s.id === serviceId);
                        if (service) { objectiveId = service.objectiveId; clientId = service.clientId; clientName = service.clientName || 'Cliente'; objectiveName = service.objectiveName || 'Objetivo'; 
                            let pos = service.positions?.find((p:any) => String(p.id) === String(posId)); if (!pos && service.positions?.length > 0) pos = service.positions[0]; if (pos && pos.name) targetPositionName = pos.name;
                        }
                    }
                    if (!objectiveId) { const gapData = processedDataRef.current.find(s => s.id === targetId); if (gapData) { objectiveId = gapData.objectiveId; clientId = gapData.clientId; targetPositionName = gapData.positionName || 'Guardia'; if (gapData.shiftDateObj) startTime = gapData.shiftDateObj; clientName = gapData.clientName; objectiveName = gapData.objectiveName; } }
                    if (objectiveId && objectiveName === 'Objetivo') { const obj = objectivesRef.current.find(o => o.id === objectiveId); if (obj) { objectiveName = obj.name; clientName = obj.clientName; } }
                    if (!objectiveId) throw new Error("No se pudo identificar el objetivo.");

                    const payload = {
                        objectiveId, clientId, clientName, objectiveName, positionName: targetPositionName, type: shiftType,
                        startTime: Timestamp.fromDate(startTime || new Date()), endTime: Timestamp.fromDate(new Date((startTime || new Date()).getTime() + 8*3600000)),
                        status: 'UNCOVERED_REPORTED', isReported: true, reportedToPlanning: true, employeeName: 'VACANTE (A ASIGNAR)', employeeId: 'VACANTE',
                        client: { id: clientId, name: clientName, razonsocial: clientName }, objective: { id: objectiveId, name: objectiveName }, metadata: { alertTitle: `Vacante: ${targetPositionName}` },
                        createdAt: serverTimestamp(), generatedFromSlaGap: true
                    };
                    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);
                    await addDoc(collection(db, 'turnos'), payload);
                } else {
                    await updateDoc(doc(db, 'turnos', targetId), { status: 'UNCOVERED_REPORTED', isReported: true, reportedToPlanning: true, comments: `No se planificó turno en puesto ${targetPositionName}`, reportedAt: serverTimestamp() });
                }
                await addDoc(collection(db, 'audit_logs'), { action: 'SLA_REPORT', targetShiftId: targetId, actorName: actorName, timestamp: serverTimestamp(), details: `Notificó falta en ${targetPositionName}` });
                toast.success("Notificado a planificación.");
            } else {
                await addDoc(collection(db, 'novedades'), { shiftId: targetId, type: targetType, notes: novedadData.nota, createdAt: serverTimestamp(), viewed: false });
                await updateDoc(doc(db, 'turnos', targetId), { hasNovedad: true });
                toast.success("Novedad reportada");
            }
            setModals(m => ({...m, novedad: false}));
        } catch (e: any) { console.error("Error técnico:", e); toast.error("No se pudo notificar: " + e.message); }
        setProcessingId(null);
    };

    return { now, processedData, listData, stats, recentLogs, objectives, servicesSLA, operatorInfo, formatName, viewTab, setViewTab, filterText, setFilterText, isCompact, setIsCompact, modals, setModals, handleAction, processingId, confirmNovedad, novedadData, setNovedadData };
};
