import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { getEmployeeShifts, callAuditShift, createAbsence } from '@/services/firebase-client.service';
import { IShift } from '@/common/interfaces/shift.interface';
import toast from 'react-hot-toast';
import { getCurrentPosition } from '@/utils/geolocation'; 

interface EmployeeDashboardProps {
  currentUser: User; 
}

type ViewMode = 'day' | 'week' | 'month';

export function EmployeeDashboard({ currentUser }: EmployeeDashboardProps) {
  const [shifts, setShifts] = useState<IShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Estados Modal Ausencia
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [selectedShiftForAbsence, setSelectedShiftForAbsence] = useState<IShift | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');

  // --- 🛠️ HELPER DE FECHAS (El corazón del arreglo) ---
  // Convierte Timestamp, {seconds...}, String o Date a un objeto Date válido de JS
  const getDateObj = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      // Caso 1: Firestore Timestamp (tiene .toDate())
      if (typeof timestamp.toDate === 'function') return timestamp.toDate();
      // Caso 2: Objeto Date nativo
      if (timestamp instanceof Date) return timestamp;
      // Caso 3: Objeto serializado { seconds, nanoseconds }
      if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
      // Caso 4: String ISO
      if (typeof timestamp === 'string') return new Date(timestamp);
      
      return new Date(); // Fallback
  };

  // --- Carga de Datos ---
  const loadShifts = async () => {
    setLoading(true);
    try {
      const data = await getEmployeeShifts(currentUser.uid);
      // Ordenamos cronológicamente
      const sorted = data.sort((a, b) => {
         return getDateObj(a.startTime).getTime() - getDateObj(b.startTime).getTime();
      });
      setShifts(sorted);
    } catch (err: any) {
      console.error(err);
      toast.error("Error al cargar agenda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (currentUser) loadShifts(); }, [currentUser]);

  // --- Filtros de Tiempo ---
  const getFilteredShifts = () => {
      const today = new Date();
      return shifts.filter(shift => {
          const date = getDateObj(shift.startTime);
          
          if (viewMode === 'day') {
              return date.getDate() === today.getDate() && 
                     date.getMonth() === today.getMonth() &&
                     date.getFullYear() === today.getFullYear();
          }
          if (viewMode === 'week') {
              // Lógica simple: Desde hoy hasta 7 días adelante
              const nextWeek = new Date();
              nextWeek.setDate(today.getDate() + 7);
              // Reseteamos horas para comparar días completos
              const d = new Date(date); d.setHours(0,0,0,0);
              const t = new Date(today); t.setHours(0,0,0,0);
              return d >= t && d <= nextWeek;
          }
          if (viewMode === 'month') {
              return date.getMonth() === today.getMonth() && 
                     date.getFullYear() === today.getFullYear();
          }
          return true;
      });
  };

  // --- Formateadores Visuales ---
  const formatTime = (ts: any) => getDateObj(ts).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
  const formatDate = (ts: any) => getDateObj(ts).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  // --- Fichaje (Check-In/Out) ---
  const handleAuditAction = async (shiftId: string, action: 'CHECK_IN' | 'CHECK_OUT') => {
    if (isAuditing || auditingId) return;
    
    setAuditingId(shiftId); 
    setIsAuditing(true);
    const toastId = toast.loading(action === 'CHECK_IN' ? "Validando ubicación..." : "Cerrando servicio...");

    try {
        const coords = await getCurrentPosition();
        await callAuditShift({ 
            shiftId, 
            action, 
            coords: { latitude: coords.latitude, longitude: coords.longitude } 
        });
        
        const msg = action === 'CHECK_IN' ? "✅ ¡Presente registrado!" : "🏁 ¡Servicio finalizado!";
        toast.success(msg, { id: toastId });
        await loadShifts(); 
    } catch (error: any) {
        let msg = "Error al procesar.";
        // Mensajes priorizados
        if (error.message?.includes('temprano')) msg = "⏳ Es muy temprano (10 min antes).";
        else if (error.message?.includes('cerca') || error.code === 'functions/failed-precondition') msg = "📍 Estás demasiado lejos.";
        else if (error.message?.includes('Permiso')) msg = "⚠️ Activa el GPS.";
        
        toast.error(msg, { id: toastId, duration: 5000 });
    } finally {
        setAuditingId(null); 
        setIsAuditing(false);
    }
  };

  // --- Reporte Ausencia ---
  const handleReportAbsence = async () => {
      if (!selectedShiftForAbsence || !absenceReason.trim()) {
          toast.error("Por favor indique el motivo."); return;
      }
      
      const toastId = toast.loading("Registrando ausencia...");
      try {
          // 🛑 FIX: Convertimos a Date nativo JS antes de enviar al servicio
          // Esto evita el error "seconds is not valid"
          const start = getDateObj(selectedShiftForAbsence.startTime);
          const end = getDateObj(selectedShiftForAbsence.endTime);

          await createAbsence({
              action: 'CREATE_ABSENCE',
              payload: {
                  employeeId: currentUser.uid,
                  employeeName: currentUser.displayName || 'Empleado',
                  clientId: selectedShiftForAbsence.objectiveId || 'unknown', 
                  type: 'SICK_LEAVE', // Podríamos agregar un selector de tipo en el modal
                  startDate: start, 
                  endDate: end,
                  reason: `[App] ${absenceReason}`
              }
          });
          toast.success("Ausencia reportada correctamente.", { id: toastId });
          setAbsenceModalOpen(false);
          setAbsenceReason('');
          // Opcional: Recargar para reflejar cambios si el backend marca el turno
          await loadShifts();
      } catch (error: any) {
          console.error(error);
          toast.error("Error: " + (error.message || "Fallo desconocido"), { id: toastId });
      }
  };

  // --- Render ---
  if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Cargando agenda...</div>;

  const filteredList = getFilteredShifts();
  // Buscamos el próximo turno relevante para el Header Azul
  const nextShift = shifts.find(s => s.status === 'Assigned' || s.status === 'InProgress');

  return (
    <div className="max-w-2xl mx-auto pb-24 px-4 font-sans">
      
      {/* 1. HEADER AZUL (RESTAURADO) */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg mb-6 mt-4 relative overflow-hidden transition-all hover:shadow-xl">
          <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-1">
                  Hola, {currentUser.displayName?.split(' ')[0] || 'Colaborador'}
              </h2>
              <p className="text-indigo-100 text-sm mb-6">Panel de Operaciones</p>
              
              <div className="flex gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 flex-1 border border-white/10">
                      <p className="text-xs text-indigo-200 uppercase font-bold">Próximo Turno</p>
                      <p className="text-lg font-bold mt-1 truncate">
                          {nextShift ? getDateObj(nextShift.startTime).toLocaleDateString('es-AR', {weekday:'short', day:'numeric'}) : 'Libre'}
                      </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 flex-1 border border-white/10">
                      <p className="text-xs text-indigo-200 uppercase font-bold">Estado</p>
                      <p className="text-lg font-bold mt-1 flex items-center gap-2">
                          {nextShift?.status === 'InProgress' ? 
                            <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"/> En Servicio</> : 
                            'Disponible'}
                      </p>
                  </div>
              </div>
          </div>
          {/* Decoración de fondo */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl"></div>
      </div>

      {/* 2. FILTROS (TABS) */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
          {(['day', 'week', 'month'] as ViewMode[]).map(m => (
              <button 
                key={m} 
                onClick={() => setViewMode(m)} 
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  {m === 'day' ? 'Hoy' : m === 'week' ? 'Semana' : 'Mes'}
              </button>
          ))}
      </div>

      {/* 3. LISTADO DE TARJETAS */}
      <div className="space-y-5">
        {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
                <span className="text-4xl mb-3">📅</span>
                <p className="text-gray-500 font-medium">No hay servicios programados.</p>
                <p className="text-sm text-gray-400">Selecciona otro filtro para ver más.</p>
            </div>
        ) : (
            filteredList.map((shift) => (
            <div key={shift.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300">
                
                {/* Header Tarjeta */}
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-gray-800 block truncate max-w-[180px] sm:max-w-xs">{shift.objectiveName || 'Objetivo'}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{shift.role || 'Vigilador'}</span>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase border ${
                        shift.status === 'InProgress' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 animate-pulse' : 
                        shift.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                        {shift.status === 'Assigned' ? 'Pendiente' : shift.status}
                    </span>
                </div>

                <div className="p-5">
                    {/* Info Tiempo */}
                    <div className="flex justify-between mb-5 text-sm">
                        <div>
                            <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">Fecha</p>
                            <p className="font-medium text-slate-700 capitalize">{formatDate(shift.startTime)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">Horario</p>
                            <p className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Botones: PENDIENTE */}
                        {shift.status === 'Assigned' && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleAuditAction(shift.id, 'CHECK_IN')}
                                    disabled={!!auditingId}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {auditingId === shift.id ? 'Validando...' : <><span>📍</span> DAR PRESENTE</>}
                                </button>
                                <button 
                                    onClick={() => { setSelectedShiftForAbsence(shift); setAbsenceModalOpen(true); }}
                                    disabled={!!auditingId}
                                    className="px-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-lg hover:bg-red-100 transition active:scale-95"
                                    title="Reportar Ausencia / Problema"
                                >
                                    🚑
                                </button>
                            </div>
                        )}

                        {/* Botones: EN CURSO */}
                        {shift.status === 'InProgress' && (
                            <button 
                                onClick={() => handleAuditAction(shift.id, 'CHECK_OUT')}
                                disabled={!!auditingId}
                                className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-rose-700 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {auditingId === shift.id ? 'Cerrando...' : <><span>🏁</span> FIN DE SERVICIO</>}
                            </button>
                        )}
                        
                        {/* Botones: FINALIZADO */}
                        {shift.status === 'Completed' && (
                            <div className="w-full bg-slate-50 text-slate-500 py-3 rounded-xl text-center text-sm font-medium border border-slate-200 flex items-center justify-center gap-2 cursor-default">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Servicio Completado
                            </div>
                        )}
                    </div>
                </div>
            </div>
            ))
        )}
      </div>

      {/* MODAL DE AUSENCIA */}
      {absenceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all">
                  <div className="flex items-center gap-3 mb-4 text-red-600">
                      <div className="bg-red-100 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Reportar Ausencia</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">
                      ¿Por qué no podrás asistir al turno en <strong>{selectedShiftForAbsence?.objectiveName}</strong>?
                  </p>
                  
                  <textarea 
                      className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-red-500 focus:border-red-500 text-sm p-3 border mb-6"
                      rows={3}
                      placeholder="Escribe el motivo aquí..."
                      value={absenceReason}
                      onChange={e => setAbsenceReason(e.target.value)}
                  />

                  <div className="flex gap-3">
                      <button onClick={() => setAbsenceModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition bg-gray-50">Cancelar</button>
                      <button onClick={handleReportAbsence} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition active:scale-95">Confirmar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}



