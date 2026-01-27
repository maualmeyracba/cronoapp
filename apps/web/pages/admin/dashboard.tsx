import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { addDays, startOfWeek, addHours, format, startOfDay, differenceInHours } from 'date-fns'; 
import { 
    Users, MapPin, Globe, Plus, RefreshCw, Trash2, Copy, X, Check, Building, AlertCircle, ArrowRight, UserX, Search, Filter, Clock, Eye, Briefcase
} from 'lucide-react';
import { collection, query, where, getDocs, Timestamp, limit } from 'firebase/firestore';

// --- IMPORTS ---
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useClient } from '@/context/ClientContext';
import { 
    callManageData, 
    callManageEmployees, 
    callScheduleShift, 
    callManageShifts, 
    callManagePatterns,
    getActiveContract, 
    db 
} from '@/services/firebase-client.service';
import { IObjective } from '@/common/interfaces/client.interface'; 
import { IEmployee, IAbsence } from '@/common/interfaces/employee.interface';
import { IShift } from '@/common/interfaces/shift.interface';

// --- SCHEDULER ---
import { DragAndDropScheduler, SchedulerEvent } from '@/components/admin/scheduler';
import toast from 'react-hot-toast';

interface PlanningStats {
  totalHours: number;
  vacancies: number;
  occupancyRate: number;
}

interface ReplicateFormState {
    sourceDate: string;
    targetStart: string;
    targetEnd: string;
    targetDays: number[];
}

const Dashboard = () => {
  const router = useRouter();
  const context = useClient();
  const client = (context as any)?.client || context?.selectedClient || null;
  const clientId = client?.id || '';

  // --- ESTADO DE DATOS ---
  const [shifts, setShifts] = useState<IShift[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [objectives, setObjectives] = useState<IObjective[]>([]);
  const [absences, setAbsences] = useState<IAbsence[]>([]);
  
  // Objetivo seleccionado
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('');

  // --- ESTADO DE UI ---
  const [loading, setLoading] = useState<boolean>(false); 
  const [stats, setStats] = useState<PlanningStats>({ totalHours: 0, vacancies: 0, occupancyRate: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // --- MODALES ---
  const [selectedShift, setSelectedShift] = useState<IShift | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReplicateOpen, setIsReplicateOpen] = useState(false);
  
  const getLocalDateString = () => {
      const d = new Date();
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [replicateForm, setReplicateForm] = useState<ReplicateFormState>({
      sourceDate: getLocalDateString(),
      targetStart: getLocalDateString(),
      targetEnd: getLocalDateString(),
      targetDays: [1, 2, 3, 4, 5] 
  });

  // --- 1. CARGA DE DATOS (FETCH) ---
  const fetchRealData = useCallback(async () => {
    setLoading(true);
    try {
      const objPayload = clientId ? { clientId } : {}; 
      
      const objRes = await callManageData({ action: 'GET_ALL_OBJECTIVES', payload: objPayload });
      const loadedObjectives = (objRes.data as any).data as IObjective[];
      setObjectives(loadedObjectives);

      if (selectedObjectiveId && !loadedObjectives.find(o => o.id === selectedObjectiveId)) {
          setSelectedObjectiveId('');
      }

      const empRes = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: objPayload });
      const loadedEmployees = (empRes.data as any).data as IEmployee[];
      setEmployees(loadedEmployees);

      // Ausencias Activas
      const absencesRef = collection(db, 'ausencias');
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const absQuery = query(
          absencesRef,
          where('endDate', '>=', Timestamp.fromDate(todayStart)),
          where('status', '==', 'APPROVED')
      );
      const absSnapshot = await getDocs(absQuery);
      const activeAbsences: IAbsence[] = [];
      absSnapshot.forEach(doc => activeAbsences.push({ id: doc.id, ...doc.data() } as unknown as IAbsence));
      setAbsences(activeAbsences);

      // Turnos
      const shiftsRef = collection(db, 'turnos');
      let q;

      if (selectedObjectiveId) {
          const startLimit = new Date();
          startLimit.setMonth(startLimit.getMonth() - 1); 
          q = query(
              shiftsRef, 
              where('objectiveId', '==', selectedObjectiveId),
              where('startTime', '>=', Timestamp.fromDate(startLimit))
          );
      } else if (loadedObjectives.length > 0) {
          const objectiveIds = loadedObjectives.map(o => o.id).slice(0, 10);
          q = query(shiftsRef, where('objectiveId', 'in', objectiveIds));
      } else {
          setShifts([]);
          setStats({ totalHours: 0, vacancies: 0, occupancyRate: 0 });
          return;
      }
      
      const querySnapshot = await getDocs(q);
      const realShifts: IShift[] = [];
      querySnapshot.forEach((doc) => {
          const data = doc.data();
          realShifts.push({ id: doc.id, ...data } as IShift);
      });

      realShifts.sort((a, b) => {
          const tA = a.startTime instanceof Timestamp ? a.startTime.toMillis() : new Date(a.startTime).getTime();
          const tB = b.startTime instanceof Timestamp ? b.startTime.toMillis() : new Date(b.startTime).getTime();
          return tA - tB;
      });

      setShifts(realShifts);
      calculateStats(realShifts);

    } catch (error: any) {
      console.error("Error cargando:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedObjectiveId]);

  const calculateStats = (data: IShift[]) => {
    const total = data.length;
    const assigned = data.filter(s => s.employeeId !== 'VACANTE').length;
    let totalHours = 0;
    data.forEach(s => {
        const start = s.startTime instanceof Timestamp ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime instanceof Timestamp ? s.endTime.toDate() : new Date(s.endTime);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
    });
    setStats({
      totalHours: Math.round(totalHours), 
      vacancies: total - assigned,
      occupancyRate: total > 0 ? Math.round((assigned / total) * 100) : 0
    });
  };

  useEffect(() => { fetchRealData(); }, [fetchRealData]);

  // --- 2. INTELIGENCIA DE RECURSOS (SMART SIDEBAR) ---
  const employeeHours = useMemo(() => {
      const hoursMap: Record<string, number> = {};
      shifts.forEach(shift => {
          if (shift.employeeId && shift.employeeId !== 'VACANTE') {
              const start = shift.startTime instanceof Timestamp ? shift.startTime.toDate() : new Date(shift.startTime);
              const end = shift.endTime instanceof Timestamp ? shift.endTime.toDate() : new Date(shift.endTime);
              const duration = differenceInHours(end, start);
              hoursMap[shift.employeeId] = (hoursMap[shift.employeeId] || 0) + duration;
          }
      });
      return hoursMap;
  }, [shifts]);

  const getEmployeeStatus = (empId: string) => {
      const hasAbsence = absences.find(a => a.employeeId === empId); 
      if (hasAbsence) return { status: 'UNAVAILABLE', reason: hasAbsence.type, hours: 0 };
      
      const hours = employeeHours[empId] || 0;
      if (hours > 48) return { status: 'OVERLOADED', hours };
      if (hours > 0) return { status: 'BUSY', hours };
      
      return { status: 'AVAILABLE', hours: 0 };
  };

  const filteredEmployees = useMemo(() => {
      const list = employees.filter(emp => {
          const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (emp.dni && emp.dni.includes(searchTerm));
          
          const matchesRole = roleFilter === 'ALL' || 
                              emp.role === roleFilter || 
                              (roleFilter === 'Vigilador' && !emp.role); 
          
          return matchesSearch && matchesRole;
      });

      return list.sort((a, b) => {
          const statA = getEmployeeStatus(a.uid);
          const statB = getEmployeeStatus(b.uid);

          const weight = (s: string) => {
              if (s === 'AVAILABLE') return 1;
              if (s === 'BUSY') return 2;
              if (s === 'OVERLOADED') return 3;
              return 4; // UNAVAILABLE
          };

          return weight(statA.status) - weight(statB.status);
      });
  }, [employees, searchTerm, roleFilter, employeeHours, absences]);


  // --- 🛑 ACCIONES (LOGICA CORREGIDA) ---
  const handleDrop = async (data: { employeeId: string, employeeName: string, start?: Date, end?: Date, targetShiftId?: string }, isRetry = false) => {
      
      // 1. Validar Disponibilidad Local
      const status = getEmployeeStatus(data.employeeId);
      if (status.status === 'UNAVAILABLE') {
          toast.error(`⛔ ${data.employeeName} tiene licencia activa.`);
          return;
      }

      let targetId = data.targetShiftId;

      // 2. 🛑 SMART SNAP: Si se soltó en espacio vacío, buscamos la vacante oculta
      if (!targetId && data.start && selectedObjectiveId) {
           const dropTime = data.start.getTime();
           
           // Buscamos un turno VACANTE en el objetivo que coincida con el horario del drop
           const candidateShift = shifts.find(s => {
               if (s.employeeId !== 'VACANTE') return false;
               if (s.objectiveId !== selectedObjectiveId) return false;
               if (s.status === 'Canceled') return false;

               const sStart = s.startTime instanceof Timestamp ? s.startTime.toMillis() : new Date(s.startTime).getTime();
               const sEnd = s.endTime instanceof Timestamp ? s.endTime.toMillis() : new Date(s.endTime).getTime();

               // Tolerancia: Si el drop cae dentro del rango del turno
               return dropTime >= sStart && dropTime < sEnd;
           });

           if (candidateShift) {
               targetId = candidateShift.id;
               console.log("🎯 Vacante encontrada:", targetId);
           }
      }

      // 3. Ejecutar Asignación (Solo si tenemos un ID de turno destino)
      if (targetId) {
          const toastId = isRetry ? toast.loading("Autorizando...") : toast.loading("Asignando...");
          try {
              await callManageShifts({
                  action: 'UPDATE_SHIFT',
                  payload: { 
                      id: targetId,
                      data: { 
                          employeeId: data.employeeId, 
                          employeeName: data.employeeName,
                          status: 'Assigned' 
                      },
                      authorizeOvertime: isRetry 
                  }
              });
              toast.success(isRetry ? "⚠️ Asignado (Exceso Autorizado)" : "Asignado correctamente", { id: toastId });
              fetchRealData();
          } catch (e: any) { 
              if (e.message && (e.message.includes('LÍMITE EXCEDIDO') || e.code === 'functions/resource-exhausted')) {
                   toast.dismiss(toastId);
                   if (confirm(`⚠️ ALERTA DE HORAS EXTRA\n\n${e.message}\n\n¿Autorizar la asignación excediendo el límite?`)) {
                       // Reintentamos pasando el targetId que encontramos
                       handleDrop({ ...data, targetShiftId: targetId }, true); 
                       return;
                   }
              } else {
                  toast.error(e.message, { id: toastId, duration: 5000 }); 
              }
          }
          return;
      }

      // 4. Si no encontró vacante, bloqueamos la creación accidental
      toast.error("⛔ Acción no permitida: Arrastre el empleado sobre una tarjeta 'VACANTE' existente.");
  };

  const handleGenerateStructure = async () => {
    // ... (sin cambios, código original)
    if (!selectedObjectiveId) return toast.error("Seleccione un Objetivo.");
    const obj = objectives.find(o => o.id === selectedObjectiveId);
    if (!obj) return;
    setLoading(true);
    const toastId = toast.loading("Buscando contrato...");
    try {
        const contract = await getActiveContract(obj.id);
        if (!contract) throw new Error("No hay contrato activo.");
        if (!confirm(`Generar vacantes según contrato "${contract.name}"?`)) {
            setLoading(false); toast.dismiss(toastId); return;
        }
        toast.loading("Generando vacantes...", { id: toastId });
        const today = new Date();
        const res = await callManagePatterns({
            action: 'GENERATE_VACANCIES',
            payload: {
                contractId: contract.id,
                objectiveId: obj.id,
                month: today.getMonth() + 1,
                year: today.getFullYear()
            }
        });
        toast.success((res.data as any).message, { id: toastId });
        fetchRealData();
    } catch (e: any) {
        toast.error(e.message, { id: toastId });
    } finally {
        setLoading(false);
    }
  };

  const handleReplicate = async () => {
      // ... (sin cambios)
      if (!selectedObjectiveId) return toast.error("Seleccione un objetivo.");
      setLoading(true);
      const toastId = toast.loading("Replicando...");
      try {
          const res = await callManageShifts({
              action: 'REPLICATE_STRUCTURE',
              payload: {
                  objectiveId: selectedObjectiveId,
                  sourceDate: replicateForm.sourceDate,
                  targetStartDate: replicateForm.targetStart,
                  targetEndDate: replicateForm.targetEnd,
                  targetDays: replicateForm.targetDays
              }
          });
          const data = res.data as any;
          toast.success(data.message, { id: toastId });
          setIsReplicateOpen(false);
          fetchRealData();
      } catch (e: any) {
          toast.error(e.message, { id: toastId });
      } finally {
          setLoading(false);
      }
  };

  const handleClearStructure = async () => {
       // ... (sin cambios)
       if (!selectedObjectiveId) return toast.error("Seleccione objetivo.");
       if (!confirm("⚠️ Se eliminarán todas las VACANTES vacías del mes actual. ¿Seguro?")) return;
       setLoading(true);
       try {
           const today = new Date();
           await callManagePatterns({
               action: 'CLEAR_VACANCIES',
               payload: { objectiveId: selectedObjectiveId, month: today.getMonth() + 1, year: today.getFullYear() }
           });
           toast.success("Limpiado");
           fetchRealData();
       } catch (e: any) { toast.error(e.message); } 
       finally { setLoading(false); }
  };

  const handleDeleteShift = async () => {
       // ... (sin cambios)
       if (!selectedShift) return;
       const isVacancy = selectedShift.employeeId === 'VACANTE';
       if (!confirm(isVacancy ? "Borrar vacante?" : "Desasignar empleado?")) return;
       try {
           if (isVacancy) {
               await callManageShifts({ action: 'DELETE_SHIFT', payload: { id: selectedShift.id } });
               toast.success("Eliminado");
           } else {
               await callManageShifts({
                   action: 'UPDATE_SHIFT',
                   payload: { id: selectedShift.id, data: { employeeId: 'VACANTE', employeeName: 'VACANTE', status: 'Assigned' } }
               });
               toast.success("Desasignado");
           }
           setIsDetailOpen(false);
           fetchRealData();
       } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicateShift = async () => {
      // ... (sin cambios)
      if (!selectedShift) return;
      try {
          const start = selectedShift.startTime instanceof Timestamp ? selectedShift.startTime.toDate() : new Date(selectedShift.startTime);
          const end = selectedShift.endTime instanceof Timestamp ? selectedShift.endTime.toDate() : new Date(selectedShift.endTime);
          await callScheduleShift({
              employeeId: selectedShift.employeeId, employeeName: selectedShift.employeeName,
              objectiveId: selectedShift.objectiveId, objectiveName: selectedShift.objectiveName,
              startTime: start, endTime: end, status: 'Assigned', role: selectedShift.role
          });
          toast.success("Duplicado");
          setIsDetailOpen(false);
          fetchRealData();
      } catch (e: any) { toast.error(e.message); }
  };

  const onEventClick = (event: SchedulerEvent) => {
      setSelectedShift(event.originalData as IShift);
      setIsDetailOpen(true);
  };

  const toggleReplicateDay = (d: number) => {
      setReplicateForm(prev => {
          const exists = prev.targetDays.includes(d);
          const newDays = exists ? prev.targetDays.filter(day => day !== d) : [...prev.targetDays, d];
          return { ...prev, targetDays: newDays.sort() };
      });
  };

  const calendarEvents: SchedulerEvent[] = useMemo(() => {
    return shifts.map((shift) => {
      const startDate = shift.startTime instanceof Timestamp ? shift.startTime.toDate() : new Date(shift.startTime);
      const endDate = shift.endTime instanceof Timestamp ? shift.endTime.toDate() : new Date(shift.endTime);
      const isVacant = shift.employeeId === 'VACANTE';
      const isGlobalView = !selectedObjectiveId;
      let title = isVacant ? 'VACANTE' : shift.employeeName;
      if (isGlobalView) title = `${shift.objectiveName} | ${title}`;

      return {
        id: shift.id,
        title: title,
        description: shift.objectiveName,
        start: startDate,
        end: endDate, 
        color: isVacant 
            ? 'bg-gray-100 border-gray-400 text-gray-500 border-dashed' 
            : (shift.isOvertime 
                ? 'bg-amber-100 border-amber-500 text-amber-900 ring-1 ring-amber-300' 
                : 'bg-indigo-100 border-indigo-600 text-indigo-900'),
        originalData: shift 
      };
    });
  }, [shifts, selectedObjectiveId]);

  const pageTitle = client?.businessName ? `Planificación - ${client.businessName}` : 'Centro de Control Global';
  const isGlobalMode = !selectedObjectiveId;

  return (
    <DashboardLayout title={pageTitle}>
      <Head><title>{pageTitle} | CronoApp</title></Head>
      <div className="flex flex-col h-[calc(100vh-80px)] space-y-4 p-2">
        {/* HEADER */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                <div className="bg-indigo-50 p-2 rounded-lg">{clientId ? <Users className="text-indigo-600" size={24}/> : <Globe className="text-blue-600" size={24}/>}</div>
                <div className="flex flex-col w-full max-w-md">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{clientId ? 'Seleccione Sede' : 'Seleccione Objetivo'}</label>
                    <div className="relative">
                        <select value={selectedObjectiveId} onChange={(e) => setSelectedObjectiveId(e.target.value)} className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:border-indigo-500 font-bold">
                            <option value="">-- Monitor Global (Solo Lectura) --</option>
                            {objectives.map(obj => <option key={obj.id} value={obj.id}>{obj.name} {clientId ? '' : `(${obj.address})`}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><MapPin size={16} /></div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-indigo-50 rounded border border-indigo-100 text-center"><span className="text-[9px] text-indigo-500 font-bold block uppercase">Horas</span><span className="text-lg font-bold text-indigo-700">{stats.totalHours}</span></div>
                <div className="px-3 py-1 bg-red-50 rounded border border-red-100 text-center"><span className="text-[9px] text-red-500 font-bold block uppercase">Vacantes</span><span className="text-lg font-bold text-red-600">{stats.vacancies}</span></div>
                <div className="h-8 w-px bg-gray-200 mx-2"></div>
                <div className="flex gap-2">
                     <button onClick={fetchRealData} className="p-2 border rounded hover:bg-gray-50 text-gray-600" title="Refrescar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
                     <button onClick={handleClearStructure} className="p-2 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50" title="Limpiar" disabled={isGlobalMode || loading}><Trash2 size={18} /></button>
                     <button onClick={() => setIsReplicateOpen(true)} className="p-2 border border-indigo-200 text-indigo-600 rounded hover:bg-indigo-50 disabled:opacity-50" title="Copiar Día" disabled={isGlobalMode || loading}><Copy size={18} /></button>
                     <button onClick={handleGenerateStructure} disabled={isGlobalMode || loading} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-sm flex items-center gap-2 disabled:opacity-50"><Plus size={18} /> Generar</button>
                </div>
            </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
            {/* SIDEBAR INTELIGENTE */}
            <div className="w-72 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col hidden md:flex">
                <div className="p-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl space-y-2">
                    <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plantilla ({filteredEmployees.length})</h3></div>
                    <div className="relative">
                        <input type="text" placeholder="Buscar..." className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-md outline-none focus:border-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <Search size={14} className="absolute left-2.5 top-2 text-gray-400"/>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {['ALL', 'Vigilador', 'Limpieza', 'Supervisor'].map(role => (
                            <button key={role} onClick={() => setRoleFilter(role)} className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border ${roleFilter === role ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'}`}>{role === 'ALL' ? 'Todos' : role}</button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-slate-50">
                    {!isGlobalMode && filteredEmployees.map(staff => {
                        const status = getEmployeeStatus(staff.uid);
                        const isUnavailable = status.status === 'UNAVAILABLE';
                        
                        return (
                            <div 
                                key={staff.uid} 
                                draggable={!isUnavailable} 
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("employeeId", staff.uid);
                                    e.dataTransfer.setData("employeeName", staff.name);
                                }}
                                className={`p-2 bg-white border rounded-lg shadow-sm group flex justify-between items-center transition-all ${
                                    isUnavailable ? 'opacity-60 bg-red-50 border-red-100 cursor-not-allowed' : 'hover:border-indigo-400 cursor-grab hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border ${isUnavailable ? 'bg-red-200 text-red-700 border-red-300' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                        {staff.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-700 truncate">{staff.name}</p>
                                        <p className="text-[9px] text-gray-400 uppercase font-medium truncate">{staff.role || 'Sin Rol'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    {isUnavailable ? (
                                        <span className="text-[9px] font-bold text-red-600 flex items-center gap-1 bg-red-100 px-1.5 py-0.5 rounded"><UserX size={10}/> LICENCIA</span>
                                    ) : (
                                        <div className="text-right">
                                             <span className={`text-[10px] font-bold flex items-center justify-end gap-1 ${status.status === 'OVERLOADED' ? 'text-amber-600' : status.hours > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                {status.hours > 0 ? <Clock size={10}/> : <Check size={10}/>} 
                                                {status.hours > 0 ? 'Ocupado' : 'Disponible'}
                                             </span>
                                             <span className="text-[10px] text-slate-400 font-mono">
                                                {status.hours} hs
                                             </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {isGlobalMode && <div className="p-4 text-center text-xs text-gray-400 italic">Seleccione un objetivo para asignar personal.</div>}
                </div>
            </div>
            
            {/* SCHEDULER */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative flex flex-col">
                <div className="absolute top-2 right-2 z-10">
                    {isGlobalMode && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-1 rounded-full shadow-sm flex items-center gap-1"><Eye size={12}/> Monitor (Solo Lectura)</div>}
                </div>
                <DragAndDropScheduler events={calendarEvents} isLoading={loading} onEventClick={onEventClick} onDropInfo={handleDrop} startHour={0} endHour={24} readOnly={isGlobalMode} />
            </div>
        </div>

        {/* MODAL DETALLE */}
        {isDetailOpen && selectedShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800">Gestionar Turno</h3><button onClick={() => setIsDetailOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button></div>
                    <div className="p-6 space-y-4">
                        <div><label className="text-xs font-bold text-gray-400 uppercase">Colaborador</label><p className="text-lg font-bold text-indigo-900">{selectedShift.employeeName === 'VACANTE' ? '🔴 VACANTE' : selectedShift.employeeName}</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase">Inicio</label><p className="text-sm font-mono">{format(selectedShift.startTime instanceof Timestamp ? selectedShift.startTime.toDate() : new Date(selectedShift.startTime), 'HH:mm')}</p></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase">Fin</label><p className="text-sm font-mono">{format(selectedShift.endTime instanceof Timestamp ? selectedShift.endTime.toDate() : new Date(selectedShift.endTime), 'HH:mm')}</p></div>
                        </div>
                        {selectedShift.isOvertime && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded flex items-center gap-2"><AlertCircle size={14}/> Horas Extra Autorizadas</div>}
                    </div>
                    {!isGlobalMode && (
                        <div className="bg-gray-50 px-6 py-4 flex justify-between gap-3">
                            <button onClick={handleDeleteShift} className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition">{selectedShift.employeeId === 'VACANTE' ? <><Trash2 size={14}/> BORRAR VACANTE</> : <><UserX size={14}/> DESASIGNAR</>}</button>
                            <button onClick={handleDuplicateShift} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition"><Copy size={14}/> DUPLICAR</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MODAL REPLICAR */}
        {isReplicateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center"><h3 className="font-bold text-indigo-800 flex items-center gap-2"><Copy size={18}/> Copiar Días</h3><button onClick={() => setIsReplicateOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button></div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">Copiar estructura del día origen al rango seleccionado.</p>
                        <div><label className="text-xs font-bold text-gray-400 uppercase">Día Modelo</label><input type="date" className="w-full border p-2 rounded" value={replicateForm.sourceDate} onChange={e => setReplicateForm({...replicateForm, sourceDate: e.target.value})} /></div>
                        <div className="flex items-center gap-2 text-gray-400 justify-center"><ArrowRight size={16}/> Aplica a <ArrowRight size={16}/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase">Desde</label><input type="date" className="w-full border p-2 rounded" value={replicateForm.targetStart} onChange={e => setReplicateForm({...replicateForm, targetStart: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase">Hasta</label><input type="date" className="w-full border p-2 rounded" value={replicateForm.targetEnd} onChange={e => setReplicateForm({...replicateForm, targetEnd: e.target.value})} /></div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Aplicar solo en:</label>
                            <div className="flex justify-between gap-1">
                                {['D','L','M','M','J','V','S'].map((day, i) => (
                                    <button key={i} onClick={() => toggleReplicateDay(i)} className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${replicateForm.targetDays.includes(i) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}>{day}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                        <button onClick={() => setIsReplicateOpen(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={handleReplicate} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Confirmar Copia</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withAuthGuard(Dashboard);



