import React, { useReducer, useMemo, useEffect, useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  addDays, 
  parseISO, 
  setHours, 
  setMinutes,
  differenceInMinutes,
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  max,
  min
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Lock,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ViewType = 'month' | 'week' | 'day';

export interface SchedulerEvent {
  id: string;
  title: string;
  description?: string;
  start: Date | string;
  end: Date | string;
  color?: string;
  originalData?: any;
}

interface SchedulerState {
  currentDate: Date;
  view: ViewType;
}

type SchedulerAction = 
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_TODAY' }
  | { type: 'SET_DATE'; payload: Date };

interface SchedulerProps {
  events: SchedulerEvent[];
  isLoading?: boolean;
  onEventClick?: (event: SchedulerEvent) => void;
  onDropInfo?: (data: { employeeId: string, employeeName: string, start?: Date, end?: Date, targetShiftId?: string }) => void;
  onEventMove?: (event: SchedulerEvent, newStart: Date, newEnd: Date) => void;
  onDateChange?: (date: Date) => void;
  onViewChange?: (view: ViewType) => void;
  startHour?: number;
  endHour?: number;
  readOnly?: boolean;
}

const schedulerReducer = (state: SchedulerState, action: SchedulerAction): SchedulerState => {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, view: action.payload };
    case 'NAVIGATE_NEXT': {
      const { view, currentDate } = state;
      let nextDate = view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, view === 'week' ? 7 : 1);
      return { ...state, currentDate: nextDate };
    }
    case 'NAVIGATE_PREV': {
      const { view, currentDate } = state;
      let prevDate = view === 'month' ? subMonths(currentDate, 1) : addDays(currentDate, view === 'week' ? -7 : -1);
      return { ...state, currentDate: prevDate };
    }
    case 'NAVIGATE_TODAY': return { ...state, currentDate: new Date() };
    case 'SET_DATE': return { ...state, currentDate: action.payload };
    default: return state;
  }
};

const Scheduler: React.FC<SchedulerProps> = ({ 
  events = [], 
  isLoading = false, 
  onEventClick, 
  onDropInfo, 
  onEventMove,
  onDateChange,
  onViewChange,
  startHour = 0, 
  endHour = 24,
  readOnly = false
}) => {
  
  const [state, dispatch] = useReducer(schedulerReducer, { currentDate: new Date(), view: 'week' });
  
  // 🛑 NUEVO: Estado para el Zoom (Altura de celda dinámica)
  const [cellHeight, setCellHeight] = useState(60); 

  useEffect(() => { if (onDateChange) onDateChange(state.currentDate); }, [state.currentDate, onDateChange]);
  useEffect(() => { if (onViewChange) onViewChange(state.view); }, [state.view, onViewChange]);

  const normalizedEvents = useMemo(() => {
    return events.map(evt => ({
      ...evt,
      start: typeof evt.start === 'string' ? parseISO(evt.start) : evt.start,
      end: typeof evt.end === 'string' ? parseISO(evt.end) : evt.end,
    }));
  }, [events]);

  // --- HANDLERS ---

  const handleSlotDrop = (e: React.DragEvent, day: Date, hour: number) => {
      e.preventDefault();
      if (readOnly) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutesAdded = Math.floor((offsetY / cellHeight) * 60);
      const roundedMinutes = Math.round(minutesAdded / 15) * 15; 

      const newStart = new Date(day);
      newStart.setHours(hour, roundedMinutes, 0, 0);

      const movedShiftId = e.dataTransfer.getData("shiftId");
      if (movedShiftId && onEventMove) {
          const shift = normalizedEvents.find(s => s.id === movedShiftId);
          if (shift) {
              const durationMs = (shift.end as Date).getTime() - (shift.start as Date).getTime();
              const newEnd = new Date(newStart.getTime() + durationMs);
              onEventMove(shift, newStart, newEnd);
          }
          return;
      }

      const employeeId = e.dataTransfer.getData("employeeId");
      const employeeName = e.dataTransfer.getData("employeeName");
      if (employeeId && onDropInfo) {
          const end = addMinutes(newStart, 480); 
          onDropInfo({ employeeId, employeeName, start: newStart, end });
      }
  };

  const handleEventDrop = (e: React.DragEvent, targetEvent: SchedulerEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      if (readOnly) return;

      const employeeId = e.dataTransfer.getData("employeeId");
      const employeeName = e.dataTransfer.getData("employeeName");

      if (employeeId && onDropInfo) {
          onDropInfo({ 
              employeeId, 
              employeeName, 
              targetShiftId: targetEvent.id 
          });
      }
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(state.currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    let days: React.ReactNode[] = []; 
    let day = startDate;
    const rows = [];

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
            const cloneDay = day;
            const isToday = isSameDay(day, new Date());
            const dayEvents = normalizedEvents
                .filter(e => isSameDay(e.start as Date, cloneDay))
                .sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime());
            
            days.push(
                <div 
                    key={day.toISOString()} 
                    className={cn(
                        "min-h-[120px] border-b border-r border-gray-100 p-1 relative transition-colors", // 🛑 Aumenté altura mínima
                        !isSameDay(day, monthStart) && day.getMonth() !== monthStart.getMonth() ? "bg-gray-50/30 text-gray-400" : "",
                        !readOnly && "hover:bg-gray-50"
                    )}
                    onClick={() => dispatch({ type: 'SET_DATE', payload: cloneDay })}
                    onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
                    onDrop={!readOnly ? (e) => {
                        const employeeId = e.dataTransfer.getData("employeeId");
                        const employeeName = e.dataTransfer.getData("employeeName");
                        if (employeeId && onDropInfo) {
                            const start = setHours(cloneDay, 9);
                            const end = setHours(cloneDay, 17);
                            onDropInfo({ employeeId, employeeName, start, end });
                        }
                    } : undefined}
                >
                    <div className="flex justify-between items-center mb-1">
                       <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-indigo-600 text-white" : "")}>
                         {format(day, 'd')}
                       </span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[90px] scrollbar-hide"> {/* 🛑 Scroll si hay muchos */}
                        {dayEvents.map(evt => (
                            <div 
                                key={evt.id} 
                                onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }} 
                                className={cn("text-[10px] px-1 rounded truncate cursor-pointer flex items-center gap-1 shadow-sm", evt.color || "bg-blue-100 text-blue-800")}
                                title={evt.title}
                                draggable={!readOnly}
                                onDragStart={!readOnly ? (e) => {
                                    e.dataTransfer.setData("shiftId", evt.id);
                                    e.dataTransfer.effectAllowed = "move";
                                } : undefined}
                                onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
                                onDrop={!readOnly ? (e) => handleEventDrop(e, evt) : undefined}
                            >
                                {readOnly && <Lock size={8} className="opacity-50"/>}
                                <span className="font-bold">{format(evt.start as Date, 'HH:mm')}</span> {evt.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
            day = addDays(day, 1);
        }
        rows.push(<div className="grid grid-cols-7" key={day.toISOString()}>{days}</div>);
        days = []; 
    }
    return <div className="border-l border-t border-gray-200">{rows}</div>;
  };

  const renderTimeGrid = () => {
    let daysToShow = state.view === 'week' 
        ? Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(state.currentDate, { weekStartsOn: 1 }), i))
        : [state.currentDate];

    const hours = Array.from({ length: endHour - startHour }).map((_, i) => startHour + i);

    return (
      <div className="flex flex-col h-full bg-white relative overflow-hidden">
        <div className="flex border-b border-gray-200 ml-14">
          {daysToShow.map(day => {
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="flex-1 py-2 text-center border-r border-gray-100">
                <div className={cn("text-xs uppercase font-bold", isToday ? "text-indigo-600" : "text-gray-500")}>{format(day, 'EEE', { locale: es })}</div>
                <div className={cn("text-lg font-bold", isToday ? "text-indigo-600" : "text-gray-800")}>{format(day, 'd')}</div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto relative flex">
          <div className="w-14 flex-shrink-0 bg-gray-50 border-r border-gray-200 sticky left-0 z-10 select-none bg-white">
            {hours.map(h => {
              const timeLabel = setMinutes(setHours(new Date(), h), 0);
              return (
                <div key={h} className="border-b border-gray-100 text-[10px] text-gray-400 text-right pr-2 pt-1 relative box-border" style={{ height: cellHeight }}>
                  <span className="-top-2 relative">{format(timeLabel, 'HH:mm')}</span>
                </div>
              );
            })}
          </div>

          <div className="flex-1 flex relative min-w-[600px]">
            <div className="absolute inset-0 flex flex-col z-0">
               {hours.map(h => <div key={h} className="w-full border-b border-gray-100 box-border" style={{ height: cellHeight }}></div>)}
            </div>

            {daysToShow.map(day => {
              // 🛑 FIX NOCTURNIDAD: Definimos el rango del día actual (00:00 a 23:59)
              const columnStart = startOfDay(day);
              const columnEnd = endOfDay(day);

              // Filtramos eventos que se superponen con este día (aunque hayan empezado ayer)
              const dayEvents = normalizedEvents.filter(evt => {
                  const s = evt.start as Date;
                  const e = evt.end as Date;
                  return isBefore(s, columnEnd) && isAfter(e, columnStart);
              });

              return (
                <div key={day.toISOString()} className="flex-1 border-r border-gray-100 relative h-full group/col">
                  
                  {!readOnly && (
                      <div className="absolute inset-0 z-0 flex flex-col opacity-0 group-hover/col:opacity-100 transition-opacity">
                          {hours.map(h => (
                              <div 
                                key={h} 
                                style={{ height: cellHeight }} 
                                className="w-full hover:bg-indigo-50/30 border-b border-transparent box-border"
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                                onDrop={(e) => handleSlotDrop(e, day, h)}
                              />
                          ))}
                      </div>
                  )}

                  {dayEvents.map(evt => {
                    const originalStart = evt.start as Date;
                    const originalEnd = evt.end as Date;

                    // 🛑 FIX: Recortamos visualmente el evento para que quepa en este día
                    // Si empieza ayer, visualmente empieza a las 00:00 de hoy
                    const visualStart = isBefore(originalStart, columnStart) ? columnStart : originalStart;
                    // Si termina mañana, visualmente termina a las 23:59 de hoy
                    const visualEnd = isAfter(originalEnd, columnEnd) ? columnEnd : originalEnd;
                    
                    const startH = visualStart.getHours();
                    const startM = visualStart.getMinutes();
                    
                    // Si el fragmento termina antes de la hora de inicio de la vista, ignorar
                    if (visualEnd.getHours() < startHour) return null; 
                    
                    const minsFromTop = (Math.max(startH, startHour) - startHour) * 60 + startM;
                    const top = Math.max(0, (minsFromTop / 60) * cellHeight);
                    
                    const durationMins = differenceInMinutes(visualEnd, visualStart);
                    const height = (durationMins / 60) * cellHeight;

                    // Ajuste mínimo para que se vea
                    const displayHeight = Math.max(height, 20);

                    return (
                      <div
                        key={`${evt.id}-${day.toISOString()}`} // Key única para fragmentos
                        onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }}
                        draggable={!readOnly}
                        onDragStart={!readOnly ? (e) => {
                            e.dataTransfer.setData("shiftId", evt.id);
                            e.dataTransfer.effectAllowed = "move";
                        } : undefined}
                        onDragOver={!readOnly ? (e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            e.dataTransfer.dropEffect = "copy"; 
                        } : undefined} 
                        onDrop={!readOnly ? (e) => handleEventDrop(e, evt) : undefined} 
                        
                        className={cn(
                            "absolute left-1 right-1 rounded border-l-4 p-1 shadow-sm cursor-pointer transition-all text-xs overflow-hidden group z-10", 
                            !readOnly && "hover:z-50 hover:brightness-95 hover:shadow-md", 
                            readOnly && "opacity-90", 
                            evt.color || "bg-indigo-50 border-indigo-500"
                        )}
                        style={{ top: `${top}px`, height: `${displayHeight}px` }}
                        title={`${evt.title}\n${format(originalStart, 'HH:mm')} - ${format(originalEnd, 'HH:mm')}`}
                      >
                        {readOnly && <Lock size={10} className="absolute top-1 right-1 text-gray-500 opacity-50"/>}
                        <div className="font-bold truncate group-hover:whitespace-normal">{evt.title}</div>
                        <div className="opacity-80 truncate text-[10px] flex items-center gap-1">
                           <Clock size={10}/> 
                           {/* Mostramos horario real, aunque visualmente esté cortado */}
                           {format(originalStart, 'HH:mm')} - {format(originalEnd, 'HH:mm')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => dispatch({ type: 'NAVIGATE_PREV' })} className="p-1 hover:bg-white rounded"><ChevronLeft size={18}/></button>
            <button onClick={() => dispatch({ type: 'NAVIGATE_TODAY' })} className="px-3 text-xs font-bold hover:bg-white rounded">Hoy</button>
            <button onClick={() => dispatch({ type: 'NAVIGATE_NEXT' })} className="p-1 hover:bg-white rounded"><ChevronRight size={18}/></button>
          </div>
          <h2 className="text-lg font-bold text-gray-800 capitalize min-w-[150px] text-center">{format(state.currentDate, 'MMMM yyyy', { locale: es })}</h2>
        </div>
        
        <div className="flex gap-2 items-center">
            {/* 🛑 CONTROLES DE ZOOM */}
            {(state.view === 'week' || state.view === 'day') && (
                <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200 mr-2">
                    <button onClick={() => setCellHeight(h => Math.max(30, h - 10))} className="p-1 hover:bg-white rounded text-gray-500" title="Alejar"><ZoomOut size={14}/></button>
                    <span className="text-[10px] font-mono w-8 text-center text-gray-400">{Math.round((cellHeight/60)*100)}%</span>
                    <button onClick={() => setCellHeight(h => Math.min(150, h + 10))} className="p-1 hover:bg-white rounded text-gray-500" title="Acercar"><ZoomIn size={14}/></button>
                </div>
            )}

            {readOnly && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md font-bold flex items-center gap-1"><Lock size={12}/> Lectura</span>}
            {isLoading && <span className="text-xs text-blue-500 animate-pulse self-center">Cargando...</span>}
            <div className="flex bg-gray-100 rounded-lg p-1">
                {(['month', 'week', 'day'] as ViewType[]).map(v => (
                    <button key={v} onClick={() => dispatch({ type: 'SET_VIEW', payload: v })} className={cn("px-3 py-1 text-xs font-medium rounded capitalize", state.view === v ? "bg-white shadow text-indigo-600" : "text-gray-500")}>
                        {v === 'month' ? 'Mes' : v === 'week' ? 'Sem' : 'Día'}
                    </button>
                ))}
            </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden relative">
        {state.view === 'month' ? renderMonthView() : renderTimeGrid()}
      </div>
    </div>
  );
};

export const DragAndDropScheduler = React.memo(Scheduler);
export default DragAndDropScheduler;



