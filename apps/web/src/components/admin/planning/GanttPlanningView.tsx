import React, { useState, useEffect, useCallback } from 'react';
import { 
    format, addDays, 
    eachDayOfInterval, isSameDay, differenceInMinutes, 
    startOfDay 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    ChevronLeft, ChevronRight, Search, Zap, Loader2, 
    ZoomIn, ZoomOut, X, Clock, User, MapPin, CheckCircle2 
} from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, callManageData } from '@/services/firebase-client.service';
import { useClient } from '@/context/ClientContext';
import { IObjective } from '@/common/interfaces/client.interface';
import { IShift } from '@/common/interfaces/shift.interface';

export function GanttPlanningView() {
    const { selectedClientId } = useClient();
    
    // Estado de Datos
    const [currentDate, setCurrentDate] = useState(new Date());
    const [objectives, setObjectives] = useState<IObjective[]>([]);
    const [shifts, setShifts] = useState<IShift[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado de UI (Zoom y Modal)
    const [cellWidth, setCellWidth] = useState(180); // Ancho base más grande por día
    const [selectedShift, setSelectedShift] = useState<IShift | null>(null);

    // Constantes
    const DAYS_TO_SHOW = 14; 

    // Helper de fechas
    const safeDate = (val: any): Date => {
        if (!val) return new Date();
        if (val.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val.seconds) return new Date(val.seconds * 1000);
        if (typeof val === 'string') return new Date(val);
        return new Date(val);
    };

    // 1. Cargar Datos
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const payload = selectedClientId ? { clientId: selectedClientId } : {};
            const objRes = await callManageData({ action: 'GET_ALL_OBJECTIVES', payload });
            const loadedObjs = (objRes.data as any).data as IObjective[];
            setObjectives(loadedObjs || []);

            if (loadedObjs && loadedObjs.length > 0) {
                const startDate = startOfDay(currentDate);
                const endDate = addDays(startDate, DAYS_TO_SHOW);
                
                // Limitamos query para evitar errores, idealmente paginar o filtrar por zona
                const targetIds = loadedObjs.slice(0, 15).map(o => o.id);
                
                if (targetIds.length > 0) {
                    const shiftsRef = collection(db, 'turnos');
                    const q = query(
                        shiftsRef,
                        where('objectiveId', 'in', targetIds),
                        where('startTime', '>=', Timestamp.fromDate(startDate)),
                        where('startTime', '<=', Timestamp.fromDate(endDate))
                    );

                    const snapshot = await getDocs(q);
                    const loadedShifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IShift[];
                    setShifts(loadedShifts);
                }
            } else {
                setShifts([]);
            }
        } catch (error) {
            console.error("Error cargando Gantt:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedClientId, currentDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 2. Generar Días
    const days = eachDayOfInterval({
        start: startOfDay(currentDate),
        end: addDays(startOfDay(currentDate), DAYS_TO_SHOW - 1)
    });

    const filteredObjectives = objectives.filter(o => 
        o.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 3. Estilos Dinámicos (Zoom)
    const getShiftStyle = (shift: IShift) => {
        const start = safeDate(shift.startTime);
        const end = safeDate(shift.endTime);
        const viewStart = startOfDay(currentDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

        const startDiffMins = differenceInMinutes(start, viewStart);
        const durationMins = differenceInMinutes(end, start);
        
        // Factor de Zoom: cellWidth px por 1440 minutos (1 día)
        const pixelsPerMinute = cellWidth / 1440;
        
        const left = startDiffMins * pixelsPerMinute;
        const width = durationMins * pixelsPerMinute;

        if (left + width < 0) return null;

        return {
            left: `${left}px`,
            width: `${Math.max(width, 4)}px`
        };
    };

    // Controladores de Zoom
    const handleZoomIn = () => setCellWidth(prev => Math.min(prev + 50, 600)); // Máx 600px por día
    const handleZoomOut = () => setCellWidth(prev => Math.max(prev - 50, 60));  // Mín 60px por día

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
            
            {/* Header Herramientas */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <Zap className="text-indigo-600" size={20} />
                        Cronograma Lineal
                    </h2>
                    
                    {/* Navegación Fechas */}
                    <div className="flex bg-white rounded-lg border border-gray-300 p-1 shadow-sm items-center">
                        <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ChevronLeft size={18}/></button>
                        <span className="px-4 text-sm font-bold flex items-center text-gray-700 min-w-[140px] justify-center">
                            {format(currentDate, 'd MMM', { locale: es })} - {format(addDays(currentDate, DAYS_TO_SHOW - 1), 'd MMM', { locale: es })}
                        </span>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ChevronRight size={18}/></button>
                    </div>

                    {/* Controles de Zoom */}
                    <div className="flex bg-white rounded-lg border border-gray-300 p-1 shadow-sm items-center ml-2">
                        <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Alejar"><ZoomOut size={16}/></button>
                        <span className="text-xs font-mono px-2 text-gray-400">Zoom</span>
                        <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Acercar"><ZoomIn size={16}/></button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {loading && <span className="text-xs text-indigo-500 flex items-center animate-pulse"><Loader2 size={14} className="mr-1 animate-spin"/> Cargando...</span>}
                    <div className="relative">
                        <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar sede..." 
                            className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Columna Izquierda: Objetivos */}
                <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white z-20 shadow-md flex flex-col h-full">
                    <div className="h-10 border-b border-gray-200 bg-gray-100/50 flex items-center px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Sede / Objetivo
                    </div>
                    <div className="overflow-hidden bg-white">
                        {filteredObjectives.map((obj) => (
                            <div key={obj.id} className="h-16 border-b border-gray-100 flex items-center px-4 hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center gap-3 w-full">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                        {obj.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-700 truncate">{obj.name}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{obj.address}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Área del Gráfico */}
                <div className="flex-1 overflow-auto bg-slate-50 relative">
                    <div className="min-w-max">
                        {/* Cabecera de Días */}
                        <div className="flex border-b border-gray-200 sticky top-0 z-10 bg-white/95 backdrop-blur shadow-sm h-10">
                            {days.map(d => {
                                const isToday = isSameDay(d, new Date());
                                return (
                                    <div key={d.toISOString()} className={`flex-shrink-0 border-r border-gray-100 flex flex-col justify-center items-center ${isToday ? 'bg-indigo-50/50' : ''}`} style={{ width: cellWidth }}>
                                        <div className="flex gap-1 items-baseline">
                                            <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {format(d, 'EEE', { locale: es })}
                                            </span>
                                            <span className={`text-xs font-bold leading-none ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                {format(d, 'd')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Cuerpo del Gráfico */}
                        <div className="relative">
                            {/* Líneas de guía verticales (Días y Sub-divisiones horarias) */}
                            <div className="absolute inset-0 flex pointer-events-none h-full">
                                {days.map(d => (
                                    <div key={d.toISOString()} className="border-r border-gray-300 h-full relative" style={{ width: cellWidth }}>
                                        {/* Líneas tenues cada 6 horas (00, 06, 12, 18) si hay suficiente zoom */}
                                        {cellWidth > 150 && (
                                            <>
                                                <div className="absolute left-[25%] top-0 bottom-0 border-r border-gray-100 border-dashed w-0"></div>
                                                <div className="absolute left-[50%] top-0 bottom-0 border-r border-gray-100 border-dashed w-0"></div>
                                                <div className="absolute left-[75%] top-0 bottom-0 border-r border-gray-100 border-dashed w-0"></div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Filas de Datos */}
                            {filteredObjectives.map((obj) => {
                                const objShifts = shifts.filter(s => s.objectiveId === obj.id);

                                return (
                                    <div key={obj.id} className="h-16 border-b border-gray-200/50 relative hover:bg-white/50 transition-colors">
                                        {objShifts.map(shift => {
                                            const style = getShiftStyle(shift);
                                            if (!style) return null;
                                            
                                            const isVacant = shift.employeeId === 'VACANTE';
                                            const start = safeDate(shift.startTime);
                                            const end = safeDate(shift.endTime);

                                            return (
                                                <div 
                                                    key={shift.id}
                                                    onClick={() => setSelectedShift(shift)} // 🛑 ABRIR MODAL
                                                    className={`absolute top-3 h-10 rounded-md shadow-sm border text-[10px] flex flex-col justify-center px-2 cursor-pointer transition-all hover:brightness-110 hover:shadow-md hover:scale-[1.01] hover:z-30 overflow-hidden whitespace-nowrap
                                                        ${isVacant 
                                                            ? 'bg-gray-100 border-gray-300 text-gray-400 border-dashed' 
                                                            : shift.isOvertime 
                                                                ? 'bg-amber-500 border-amber-600 text-white'
                                                                : 'bg-indigo-600 border-indigo-700 text-white'
                                                        }
                                                    `}
                                                    style={style}
                                                    title={`${shift.employeeName} (${format(start, 'HH:mm')} - ${format(end, 'HH:mm')})`}
                                                >
                                                    <span className="font-bold truncate">{isVacant ? 'VACANTE' : shift.employeeName}</span>
                                                    {cellWidth > 80 && (
                                                        <span className="opacity-90 text-[9px] font-mono">{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* 🛑 MODAL DE DETALLE DEL TURNO */}
            {selectedShift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Clock size={16} className="text-indigo-600"/> Detalle de Turno
                            </h3>
                            <button onClick={() => setSelectedShift(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            
                            {/* Empleado */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Colaborador</label>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedShift.employeeId === 'VACANTE' ? 'bg-gray-100 text-gray-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {selectedShift.employeeName === 'VACANTE' ? 'V' : selectedShift.employeeName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{selectedShift.employeeName}</p>
                                        <p className="text-xs text-gray-500">{selectedShift.employeeId === 'VACANTE' ? 'Posición vacante' : 'Asignado'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Horario y Lugar */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Horario</label>
                                    <p className="font-mono text-sm text-indigo-700 font-bold">
                                        {format(safeDate(selectedShift.startTime), 'HH:mm')} - {format(safeDate(selectedShift.endTime), 'HH:mm')}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">{differenceInMinutes(safeDate(selectedShift.endTime), safeDate(selectedShift.startTime)) / 60} horas</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Objetivo</label>
                                    <p className="text-xs font-bold text-gray-700 line-clamp-2">{selectedShift.objectiveName}</p>
                                </div>
                            </div>

                            {/* Estado */}
                            <div className="pt-2">
                                <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold ${
                                    selectedShift.status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-100' :
                                    selectedShift.status === 'InProgress' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                                    'bg-gray-50 text-gray-500 border border-gray-200'
                                }`}>
                                    <CheckCircle2 size={14} /> 
                                    Estado: {selectedShift.status === 'Assigned' ? 'Programado' : selectedShift.status}
                                </div>
                            </div>

                        </div>
                        <div className="bg-gray-50 px-5 py-3 flex justify-end">
                            <button onClick={() => setSelectedShift(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}



