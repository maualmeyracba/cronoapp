import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { callManageHierarchy, createPattern } from '@/services/firebase-client.service';
import toast from 'react-hot-toast';
import { 
    Building2, MapPin, FileText, Clock, CheckCircle2, 
    ArrowRight, Plus, Calendar, Calculator, AlertTriangle
} from 'lucide-react';

interface ShiftTypeUI {
  name: string;
  code: string;
  startTime: string;
  durationHours: number;
}

export function ClientSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [ids, setIds] = useState({ clientId: '', objectiveId: '', contractId: '' });
  const [addedShifts, setAddedShifts] = useState<ShiftTypeUI[]>([]);

  // STATES
  const [clientData, setClientData] = useState({ businessName: '', cuit: '', contactName: '', contactEmail: '' });
  const [objData, setObjData] = useState({ name: '', address: '', latitude: '', longitude: '' });
  
  // 🛑 FIX: Estado extendido para el contrato (Días y Fechas)
  const [contractData, setContractData] = useState({ 
      name: '', 
      totalHoursPerMonth: 720,
      startDate: new Date().toISOString().split('T')[0], // Default Hoy YYYY-MM-DD
      endDate: '',
      daysOfWeek: [1, 2, 3, 4, 5] // Default Lunes a Viernes
  });
  
  const [shiftData, setShiftData] = useState<ShiftTypeUI>({ 
    name: 'Turno Mañana', 
    code: 'TM', 
    startTime: '06:00', 
    durationHours: 8 
  });

  // --- CALCULADORA EN TIEMPO REAL ---
  const [metrics, setMetrics] = useState({ totalVacancies: 0, totalHours: 0 });

  useEffect(() => {
      // Calculamos proyección solo si hay fechas y turnos
      if (!contractData.startDate || addedShifts.length === 0) return;
      
      const start = new Date(contractData.startDate);
      // Si hay fecha fin la usamos, sino proyectamos a fin de mes de la fecha de inicio
      const end = contractData.endDate 
          ? new Date(contractData.endDate) 
          : new Date(start.getFullYear(), start.getMonth() + 1, 0);

      let workingDaysCount = 0;
      
      // Iterar días para contar hábiles según configuración
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          // getDay(): 0=Dom, 1=Lun...
          if (contractData.daysOfWeek.includes(d.getDay())) {
              workingDaysCount++;
          }
      }

      // Total Turnos Diarios (Suma de todas las modalidades)
      // Asumimos 1 persona por modalidad (si fueran más, habría que agregar campo 'quantity' al shiftData)
      const shiftsPerDay = addedShifts.length; 
      const totalHoursPerDay = addedShifts.reduce((acc, curr) => acc + curr.durationHours, 0);

      setMetrics({
          totalVacancies: workingDaysCount * shiftsPerDay,
          totalHours: workingDaysCount * totalHoursPerDay
      });

  }, [contractData, addedShifts]);

  // --- HANDLERS ---

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await callManageHierarchy({ action: 'CREATE_CLIENT', payload: { ...clientData, status: 'Active' } });
      const data = res.data as any;
      setIds(prev => ({ ...prev, clientId: data.data.id }));
      toast.success("Empresa registrada");
      setStep(2);
    } catch (error: any) { toast.error(error.message); } 
    finally { setLoading(false); }
  };

  const handleCreateObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...objData,
        clientId: ids.clientId,
        location: { latitude: Number(objData.latitude), longitude: Number(objData.longitude) },
        type: 'Sede'
      };
      const res = await callManageHierarchy({ action: 'CREATE_OBJECTIVE', payload });
      const data = res.data as any;
      setIds(prev => ({ ...prev, objectiveId: data.data.id }));
      toast.success("Sede creada");
      setStep(3);
    } catch (error: any) { toast.error(error.message); } 
    finally { setLoading(false); }
  };

  // 🛑 PASO 3 CORREGIDO: Envía fechas y días reales
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        objectiveId: ids.objectiveId,
        name: contractData.name,
        totalHoursPerMonth: contractData.totalHoursPerMonth,
        startDate: new Date(contractData.startDate).toISOString(),
        endDate: contractData.endDate ? new Date(contractData.endDate).toISOString() : undefined,
        daysOfWeek: contractData.daysOfWeek, // Enviamos el array elegido
        quantity: 1, // Dotación base por turno (simplificado)
        isActive: true
      };
      
      const res = await callManageHierarchy({ action: 'CREATE_CONTRACT', payload });
      const data = res.data as any;
      setIds(prev => ({ ...prev, contractId: data.data.id }));
      
      toast.success("Contrato configurado");
      setStep(4);
    } catch (error: any) { toast.error(error.message); } 
    finally { setLoading(false); }
  };

  const handleCreateShiftType = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Crear Tipo de Turno
      const payload = { ...shiftData, contractId: ids.contractId, color: '#3B82F6' };
      const resShift = await callManageHierarchy({ action: 'CREATE_SHIFT_TYPE', payload });
      const shiftTypeData = (resShift.data as any).data;

      // 2. 🛑 Crear Patrón Automático usando la configuración del contrato (Paso 3)
      await createPattern({
          contractId: ids.contractId,
          shiftTypeId: shiftTypeData.id,
          daysOfWeek: contractData.daysOfWeek, // Usamos los días elegidos en Paso 3
          quantity: 1, 
          validFrom: new Date(contractData.startDate).toISOString(), // Fecha inicio real
          validTo: contractData.endDate ? new Date(contractData.endDate).toISOString() : undefined
      });
      
      toast.success("Modalidad y Regla agregadas");
      setAddedShifts(prev => [...prev, shiftData]);
      
      // Reset form sugerido
      let nextTime = '06:00';
      if (shiftData.startTime === '06:00') nextTime = '14:00';
      if (shiftData.startTime === '14:00') nextTime = '22:00';

      setShiftData({ 
        name: '', 
        code: '', 
        startTime: nextTime, 
        durationHours: 8 
      });

    } catch (error: any) { toast.error(error.message); } 
    finally { setLoading(false); }
  };

  const handleFinish = () => {
    toast.success("¡Configuración lista!");
    router.push('/admin/dashboard');
  };

  // Helper para toggle de días
  const toggleDay = (dayIndex: number) => {
      setContractData(prev => {
          const exists = prev.daysOfWeek.includes(dayIndex);
          const newDays = exists 
              ? prev.daysOfWeek.filter(d => d !== dayIndex)
              : [...prev.daysOfWeek, dayIndex].sort();
          return { ...prev, daysOfWeek: newDays };
      });
  };

  const inputClass = "w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2.5 px-3 border mt-1 text-sm";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";
  const btnClass = "w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-bold shadow-md flex justify-center items-center gap-2 disabled:opacity-50";

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-100 my-8">
      
      <div className="flex justify-between mb-8 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 rounded"></div>
        {['Empresa', 'Sede', 'Contrato', 'Turnos'].map((label, i) => {
            const num = i + 1;
            return (
                <div key={num} className="flex flex-col items-center gap-2 bg-white px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= num ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-300'}`}>
                        {step > num ? <CheckCircle2 size={16}/> : num}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{label}</span>
                </div>
            )
        })}
      </div>

      <div className="min-h-[300px]">
          {step === 1 && (
            <form onSubmit={handleCreateClient} className="space-y-4 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800">Datos de la Empresa</h2>
                <div><label className={labelClass}>Razón Social</label><input className={inputClass} value={clientData.businessName} onChange={e => setClientData({...clientData, businessName: e.target.value})} required autoFocus /></div>
                <div><label className={labelClass}>CUIT</label><input className={inputClass} value={clientData.cuit} onChange={e => setClientData({...clientData, cuit: e.target.value})} required /></div>
                <button type="submit" disabled={loading} className={btnClass}>{loading ? '...' : 'Siguiente'}</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleCreateObjective} className="space-y-4 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800">Ubicación del Servicio</h2>
                <div><label className={labelClass}>Nombre Sede</label><input className={inputClass} value={objData.name} onChange={e => setObjData({...objData, name: e.target.value})} required /></div>
                <div><label className={labelClass}>Dirección</label><input className={inputClass} value={objData.address} onChange={e => setObjData({...objData, address: e.target.value})} required /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelClass}>Latitud</label><input type="number" className={inputClass} value={objData.latitude} onChange={e => setObjData({...objData, latitude: e.target.value})} step="any" required/></div>
                    <div><label className={labelClass}>Longitud</label><input type="number" className={inputClass} value={objData.longitude} onChange={e => setObjData({...objData, longitude: e.target.value})} step="any" required/></div>
                </div>
                <button type="submit" disabled={loading} className={btnClass}>{loading ? '...' : 'Siguiente'}</button>
            </form>
          )}

          {/* 🛑 PASO 3: CONFIGURACIÓN CRÍTICA DE FECHAS Y DÍAS */}
          {step === 3 && (
            <form onSubmit={handleCreateContract} className="space-y-5 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800">Definición del Acuerdo</h2>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><label className={labelClass}>Nombre Servicio</label><input className={inputClass} value={contractData.name} onChange={e => setContractData({...contractData, name: e.target.value})} required /></div>
                    <div><label className={labelClass}>Horas Mensuales (Vendidas)</label><input type="number" className={inputClass} value={contractData.totalHoursPerMonth} onChange={e => setContractData({...contractData, totalHoursPerMonth: +e.target.value})} required /></div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-700 text-sm font-bold border-b border-slate-200 pb-2 mb-2">
                        <Calendar size={16}/> Vigencia y Cobertura
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Fecha Inicio</label><input type="date" className={inputClass} value={contractData.startDate} onChange={e => setContractData({...contractData, startDate: e.target.value})} required /></div>
                        <div><label className={labelClass}>Fecha Fin (Opcional)</label><input type="date" className={inputClass} value={contractData.endDate} onChange={e => setContractData({...contractData, endDate: e.target.value})} /></div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>Días de Cobertura</label>
                        <div className="flex justify-between mt-2">
                            {['D','L','M','M','J','V','S'].map((day, i) => (
                                <button 
                                    key={i} 
                                    type="button"
                                    onClick={() => toggleDay(i)}
                                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${contractData.daysOfWeek.includes(i) ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-white border border-slate-200 text-slate-400'}`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={loading} className={btnClass}>{loading ? 'Guardando...' : 'Confirmar Configuración'}</button>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
                
                {/* 🛑 CALCULADORA PREDICTIVA */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-2"><Calculator size={14}/> Proyección Mensual</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className={`text-2xl font-bold ${metrics.totalHours > contractData.totalHoursPerMonth ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {metrics.totalHours} hs
                                </span>
                                <span className="text-slate-500">/ {contractData.totalHoursPerMonth} hs</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {metrics.totalVacancies} Vacantes totales ({addedShifts.length} turnos x {metrics.totalVacancies / (addedShifts.length || 1)} días)
                            </p>
                        </div>
                        {metrics.totalHours > contractData.totalHoursPerMonth && (
                            <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/50 text-red-300">
                                <AlertTriangle size={20} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Agregar Modalidad</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input className={inputClass} value={shiftData.name} onChange={e => setShiftData({...shiftData, name: e.target.value})} placeholder="Nombre (ej: Mañana)" />
                        <input className={inputClass} value={shiftData.code} onChange={e => setShiftData({...shiftData, code: e.target.value})} placeholder="Código (ej: TM)" />
                        <input type="time" className={inputClass} value={shiftData.startTime} onChange={e => setShiftData({...shiftData, startTime: e.target.value})} />
                        <input type="number" className={inputClass} value={shiftData.durationHours} onChange={e => setShiftData({...shiftData, durationHours: +e.target.value})} placeholder="Horas" />
                    </div>
                    <button onClick={handleCreateShiftType} disabled={loading || !shiftData.name} className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg hover:bg-slate-200 font-bold transition flex justify-center items-center gap-2 border border-slate-200">
                        <Plus size={16}/> Agregar Turno
                    </button>
                </div>

                {addedShifts.length > 0 && (
                    <div className="space-y-2">
                        {addedShifts.map((shift, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                                <span className="font-bold text-slate-700">{shift.name}</span>
                                <span className="font-mono text-xs bg-white px-2 py-1 rounded border">{shift.startTime} ({shift.durationHours}h)</span>
                            </div>
                        ))}
                    </div>
                )}
                
                <button onClick={handleFinish} className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold shadow-md">
                    Finalizar y Ver Planificador
                </button>
            </div>
          )}
      </div>
    </div>
  );
}



