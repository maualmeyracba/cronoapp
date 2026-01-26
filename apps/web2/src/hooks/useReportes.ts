import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';

// --- CONSTANTES Y HELPERS ---
const OPERATIVE_CODES = ['M', 'T', 'N', 'D12', 'N12', 'PU', 'GU', 'FT']; 
const SHIFT_HOURS_LOOKUP: Record<string, number> = { 
    'M':8, 'T':8, 'N':8, 'D12':12, 'N12':12, 'PU':12, 'GU':8, 'FT': 0, 
    'F':0, 'V':0, 'L':0, 'A':0, 'E':0, 'FF':0 
};

// Helper seguro para fechas (Formato local Argentina)
const getArgentinaDate = (dateInput: any): string => {
    if (!dateInput) return '';
    try {
        const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return ''; 
    }
};

// Cálculo de horas nocturnas (21:00 a 06:00)
const getNightDuration = (start: Date, end: Date) => {
    let durationMins = 0;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    let current = new Date(start.getTime());
    const endTime = end.getTime();
    
    // Seguridad anti-loop (max 24hs)
    let safety = 0;
    while (current.getTime() < endTime && safety < 1440) {
        const h = current.getHours();
        if (h >= 21 || h < 6) durationMins++;
        current.setMinutes(current.getMinutes() + 1);
        safety++;
    }
    return durationMins / 60;
};

// Calculadora CCT 507/07
const calculateStatsExact = (shifts: any[], holidaysMap: Record<string, boolean>) => {
    // 1. FILTRO DE SEGURIDAD: Solo procesar turnos con fechas válidas
    const validShifts = shifts.filter(s => s.startTime && s.endTime && s.startTime.seconds && s.endTime.seconds);

    // Ordenamos en memoria
    const sortedDocs = [...validShifts].sort((a, b) => a.startTime.seconds - b.startTime.seconds);
    
    let hoursTotalOperativas = 0;
    let totalDiurnas = 0;
    let totalNocturnas = 0;
    let hoursFT = 0;        
    let hoursFeriado = 0;   
    
    sortedDocs.forEach(d => {
        try {
            const st = (d.status || '').toLowerCase();
            if (st.includes('cancel') || st.includes('delet')) return;
            if (d.type === 'NOVEDAD') return;
            
            const rawCode = (d.code || '').trim().toUpperCase();
            if (['F', 'FF', 'V', 'L', 'A', 'E'].includes(rawCode)) return;
            
            const start = d.startTime.toDate();
            const end = d.endTime.toDate();
            
            let duration = (end.getTime() - start.getTime()) / 3600000;
            
            // Corrección de seguridad para datos sucios
            if (duration < 0 || duration > 24 || isNaN(duration)) {
                duration = SHIFT_HOURS_LOOKUP[rawCode] || 8;
            }
            
            const night = getNightDuration(start, end);
            const day = Math.max(0, duration - night);
            const dateKey = getArgentinaDate(d.startTime);
            
            const isFeriado = holidaysMap[dateKey];
            const isFT = d.isFrancoTrabajado || rawCode === 'FT'; 

            if (isFeriado) { hoursFeriado += duration; }

            if (isFT) {
                hoursFT += duration;
                totalNocturnas += night;
                totalDiurnas += day;
            } else {
                hoursTotalOperativas += duration;
                totalNocturnas += night;
                totalDiurnas += day;
            }
        } catch (err) {
            console.warn("Saltando turno corrupto:", d.id);
        }
    });

    const baseLimit = 200;
    const excess = Math.max(0, hoursTotalOperativas - baseLimit);
    const horasSimples = Math.min(hoursTotalOperativas, baseLimit);

    return {
        totalReal: hoursTotalOperativas + hoursFT,
        horasSimples,
        totalDiurnas,
        totalNocturnas,
        extra50: excess,
        extra100: hoursFT,
        plusFeriado: hoursFeriado
    };
};

export const useReportes = () => {
    const [loading, setLoading] = useState(false);
    
    // Inicializamos fechas locales
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    const [dateRange, setDateRange] = useState({ start: todayStr, end: todayStr });
    
    const [employeeReport, setEmployeeReport] = useState<any[]>([]);
    const [objectiveReport, setObjectiveReport] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    
    const [empMap, setEmpMap] = useState<Record<string, string>>({});
    const [objMap, setObjMap] = useState<Record<string, string>>({});
    const [clientMap, setClientMap] = useState<Record<string, string>>({});
    const [holidaysData, setHolidaysData] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const [s, c, h] = await Promise.all([ 
                    getDocs(collection(db, 'empleados')), 
                    getDocs(collection(db, 'clients')),
                    getDocs(collection(db, 'feriados'))
                ]);
                
                const emps: any = {};
                s.forEach(d => {
                    const data = d.data();
                    emps[d.id] = data.name || (data.firstName ? `${data.lastName}, ${data.firstName}` : 'Sin Nombre');
                });
                setEmpMap(emps);
                
                const objs: any = {};
                const clis: any = {};
                c.forEach(doc => {
                    const data = doc.data();
                    clis[doc.id] = data.name;
                    if (data.objetivos) {
                        data.objetivos.forEach((obj: any) => {
                            const oid = obj.id || obj.name;
                            objs[oid] = obj.name; 
                        });
                    }
                });
                setObjMap(objs);
                setClientMap(clis);

                const holidays: any = {};
                h.docs.forEach(d => { if(d.data().date) holidays[d.data().date] = true; });
                setHolidaysData(holidays);

            } catch (e) { console.error("Error cargando catálogos:", e); }
        };
        loadCatalogs();
    }, []);

    const generateReports = async () => {
        if (!dateRange.start || !dateRange.end) return toast.error("Seleccione un rango de fechas");
        setLoading(true);
        setEmployeeReport([]);
        setObjectiveReport([]);

        try {
            // FIX CRÍTICO DE FECHAS: Usar formato ISO Local
            const startDate = new Date(`${dateRange.start}T00:00:00`);
            const endDate = new Date(`${dateRange.end}T23:59:59.999`);

            if (startDate > endDate) {
                toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'");
                setLoading(false);
                return;
            }

            // Consulta SIN indices complejos (filtrado en memoria si es necesario, o básico por fecha)
            const q = query(
                collection(db, 'turnos'),
                where('startTime', '>=', Timestamp.fromDate(startDate)),
                where('startTime', '<=', Timestamp.fromDate(endDate))
            );

            const shiftsSnap = await getDocs(q);
            
            // FILTRADO DEFENSIVO: Eliminar basura antes de procesar
            const rawShifts = shiftsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((d: any) => {
                    // Validar que tenga fechas y que sean Timestamps válidos
                    return d.startTime && d.endTime && typeof d.startTime.toDate === 'function';
                });

            if (rawShifts.length === 0) {
                toast.info("No se encontraron turnos válidos en este rango.");
            }

            // 3. Procesamiento por Empleado
            const empGroups: any = {};
            rawShifts.forEach((s: any) => {
                if(!empGroups[s.employeeId]) empGroups[s.employeeId] = [];
                empGroups[s.employeeId].push(s);
            });

            const empRows = Object.keys(empGroups).map(empId => {
                const shifts = empGroups[empId];
                const stats = calculateStatsExact(shifts, holidaysData);
                
                const ftCount = shifts.filter((s:any) => s.isFrancoTrabajado || s.code === 'FT').length;
                const ffCount = shifts.filter((s:any) => s.isFrancoCompensatorio || s.code === 'FF').length;

                return {
                    id: empId,
                    type: 'EMPLOYEE',
                    name: empMap[empId] || 'Desconocido', 
                    shifts: shifts.filter((s:any) => OPERATIVE_CODES.includes((s.code||'').trim().toUpperCase())).length,
                    total: stats.totalReal,
                    diurnas: stats.totalDiurnas,
                    nocturnas: stats.totalNocturnas,
                    extra50: stats.extra50,
                    extra100: stats.extra100,
                    plusFeriado: stats.plusFeriado,
                    ftCount,
                    ffCount,
                    rawShifts: shifts 
                };
            });
            setEmployeeReport(empRows.sort((a,b) => b.total - a.total));

            // 4. Procesamiento por Objetivo
            const objGroups: any = {};
            rawShifts.forEach((s: any) => {
                if (s.type === 'NOVEDAD' || !OPERATIVE_CODES.includes((s.code||'').trim().toUpperCase())) return;
                
                const key = s.objectiveId || 'SIN_OBJETIVO';
                if(!objGroups[key]) objGroups[key] = { shifts: [], clientId: s.clientId };
                objGroups[key].shifts.push(s);
            });

            const objRows = Object.keys(objGroups).map(objId => {
                const data = objGroups[objId];
                const stats = calculateStatsExact(data.shifts, holidaysData);
                return {
                    id: objId,
                    type: 'OBJECTIVE',
                    name: objMap[objId] || objId,
                    clientId: data.clientId,
                    client: clientMap[data.clientId] || 'Sin Cliente',
                    shifts: data.shifts.length,
                    total: stats.totalReal,
                    diurnas: stats.totalDiurnas,
                    nocturnas: stats.totalNocturnas,
                    extra50: stats.extra50,
                    extra100: stats.extra100,
                    plusFeriado: stats.plusFeriado,
                    rawShifts: data.shifts
                };
            });
            setObjectiveReport(objRows.sort((a,b) => a.client.localeCompare(b.client)));

        } catch (error: any) {
            console.error("Error generando reporte:", error);
            if(error.message?.includes("index")) {
                toast.error("Falta índice en Firebase. Revisa la consola.");
            } else {
                toast.error("Error al procesar datos.");
            }
        } finally {
            setLoading(false);
        }
    };

    const loadAudit = async () => {
        setLoading(true);
        try {
            const startDate = new Date(`${dateRange.start}T00:00:00`);
            const endDate = new Date(`${dateRange.end}T23:59:59.999`);

            const q = query(
                collection(db, 'audit_logs'), 
                where('timestamp', '>=', Timestamp.fromDate(startDate)), 
                where('timestamp', '<=', Timestamp.fromDate(endDate))
            );
            
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            setAuditLogs(logs.sort((a:any, b:any) => b.timestamp.seconds - a.timestamp.seconds));
            
        } catch(e) { console.error(e); } finally { setLoading(false); }
    };

    return {
        loading,
        dateRange, setDateRange,
        generateReports,
        loadAudit,
        employeeReport,
        objectiveReport,
        auditLogs,
        SHIFT_HOURS_LOOKUP, 
        OPERATIVE_CODES
    };
};