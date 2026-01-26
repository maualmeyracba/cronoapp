import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
    Users, Building, Download, Printer, 
    Calendar, User, X, ChevronRight, Sun, Moon
} from 'lucide-react';
import { db } from '@/lib/firebase'; // Necesario para el log de descarga
import { getAuth } from 'firebase/auth'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useReportes } from '@/hooks/useReportes'; // <--- IMPORTAMOS EL HOOK

// --- ESTILOS DE IMPRESIÓN (MANTENIDOS) ---
const PrintStyles = () => (
    <style>{`
        @media print {
            @page { margin: 0.5cm; size: landscape; }
            body { background: white !important; -webkit-print-color-adjust: exact; font-family: sans-serif; }
            .no-print, nav, aside, button, .dashboard-header { display: none !important; }
            .print-only { display: block !important; }
            .print-container { width: 100%; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
            table { width: 100%; border-collapse: collapse; font-size: 8pt; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
            th { background-color: #f3f4f6 !important; color: #000 !important; font-weight: bold; }
            .text-indigo-600, .text-emerald-400, .text-rose-400 { color: #000 !important; }
        }
        .print-only { display: none; }
    `}</style>
);

// Helpers visuales
const formatTime = (dateInput: any) => {
    const d = dateInput?.seconds ? new Date(dateInput.seconds * 1000) : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateInput: any) => {
    const d = dateInput?.seconds ? new Date(dateInput.seconds * 1000) : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

const getNightDuration = (start: Date, end: Date) => {
    // Reutilizamos lógica visual simple si se necesita en render,
    // pero los datos ya vienen calculados del hook.
    let durationMins = 0;
    let current = new Date(start.getTime());
    const endTime = end.getTime();
    while (current.getTime() < endTime) {
        const h = current.getHours();
        if (h >= 21 || h < 6) durationMins++;
        current.setMinutes(current.getMinutes() + 1);
    }
    return durationMins / 60;
};

const DICTIONARY: Record<string, string> = {
    'MANUAL_CHECKIN': 'Fichada Manual', 'CHECKIN': 'Entrada', 'CHECKOUT': 'Salida',
    'ASIGNACION_TURNO': 'Asignación', 'ELIMINACION_TURNO': 'Eliminación',
    'CAMBIO_DOTACION': 'Cambio Dotación', 'ALTA_EMPLEADO': 'Alta Empleado',
    'BAJA_EMPLEADO': 'Baja Empleado', 'EDICION_CLIENTE': 'Edición Cliente',
    'AUTORIZACION_EXCEPCION': 'Excepción', 'ASIGNACION_MASIVA': 'Carga Masiva',
    'CAMBIO_FRANCO_TURNO': 'Franco Trab. (FT)', 'CAMBIO_DIAGRAMA': 'Enroque',
    'CAMBIO_TURNO_FRANCO': 'Devolución (FF)'
};

export default function ReportsPage() {
    // Usamos el Hook
    const { 
        loading, dateRange, setDateRange, generateReports, loadAudit,
        employeeReport, objectiveReport, auditLogs,
        SHIFT_HOURS_LOOKUP, OPERATIVE_CODES
    } = useReportes();

    const [activeTab, setActiveTab] = useState<'EMPLOYEE' | 'OBJECTIVE' | 'AUDIT' | 'SHIFTS'>('EMPLOYEE');
    const [selectedDetailEmployee, setSelectedDetailEmployee] = useState<string>('');
    const [detailItem, setDetailItem] = useState<any | null>(null);
    const [currentUserName, setCurrentUserName] = useState("Cargando...");

    useEffect(() => {
        const auth = getAuth();
        if (auth.currentUser) setCurrentUserName(auth.currentUser.displayName || auth.currentUser.email || "Usuario");
    }, []);

    // Función de descarga CSV (Mantenida local porque usa interacción con DOM)
    const downloadCSV = async (data: any[], filename: string) => {
        if (!data.length) return;
        const auth = getAuth();
        const u = auth.currentUser;
        await addDoc(collection(db, 'audit_logs'), { timestamp: serverTimestamp(), actorUid: u?.uid || 'system', actorName: currentUserName, action: 'EXPORT_REPORT', module: 'REPORTES', details: `Exportó ${filename}.csv` });

        const rows = data.map(obj => {
            const { rawShifts, type, id, clientId, ...rest } = obj; 
            return Object.values(rest).join(',');
        }).join('\n');
        const headers = Object.keys(data[0]).filter(k => !['rawShifts','type','id','clientId'].includes(k)).join(',');
        const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
    };

    // --- RENDERIZADO TABLA OBJETIVOS ---
    const renderObjectiveTable = () => {
        const groupedByClient: any = {};
        objectiveReport.forEach(row => {
            if (!groupedByClient[row.client]) groupedByClient[row.client] = [];
            groupedByClient[row.client].push(row);
        });

        const grandTotal = objectiveReport.reduce((acc, curr) => ({
            shifts: acc.shifts + curr.shifts,
            total: acc.total + curr.total,
            diurnas: acc.diurnas + curr.diurnas,
            nocturnas: acc.nocturnas + curr.nocturnas,
            extra50: acc.extra50 + curr.extra50,
            extra100: acc.extra100 + curr.extra100,
            plusFeriado: acc.plusFeriado + curr.plusFeriado
        }), { shifts: 0, total: 0, diurnas: 0, nocturnas: 0, extra50: 0, extra100: 0, plusFeriado: 0 });

        return (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print-container">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 no-print">
                    <h3 className="font-black text-sm uppercase flex gap-2"><Building size={16}/> Costos por Objetivo</h3>
                    <div className="flex gap-2">
                        <button onClick={() => downloadCSV(objectiveReport, 'reporte_objetivos')} className="p-2 bg-white border rounded hover:bg-slate-100 text-slate-500"><Download size={16}/></button>
                        <button onClick={() => window.print()} className="p-2 bg-white border rounded hover:bg-slate-100 text-slate-500"><Printer size={16}/></button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Objetivo</th>
                                <th className="p-4 text-center">Turnos</th>
                                <th className="p-4 text-center text-indigo-600">Total Hs</th>
                                <th className="p-4 text-center">Diurnas</th>
                                <th className="p-4 text-center">Noct.</th>
                                <th className="p-4 text-center text-rose-600">Ex 100%</th>
                                <th className="p-4 text-center text-emerald-600">Feriado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {Object.keys(groupedByClient).map(clientName => {
                                const rows = groupedByClient[clientName];
                                return (
                                    <React.Fragment key={clientName}>
                                        <tr className="bg-slate-100/50 border-b border-slate-200">
                                            <td colSpan={7} className="px-4 py-2 font-black text-xs text-slate-500 uppercase tracking-wider">{clientName}</td>
                                        </tr>
                                        {rows.map((row:any) => (
                                            <tr key={row.id} className="hover:bg-slate-50">
                                                <td className="p-4 pl-8 text-slate-700 font-bold">{row.name}</td>
                                                <td className="p-4 text-center">{row.shifts}</td>
                                                <td className="p-4 text-center font-black text-indigo-600">{row.total.toFixed(1)}</td>
                                                <td className="p-4 text-center text-slate-500">{row.diurnas.toFixed(1)}</td>
                                                <td className="p-4 text-center text-slate-500">{row.nocturnas.toFixed(1)}</td>
                                                <td className="p-4 text-center font-bold text-rose-600">{row.extra100.toFixed(1)}</td>
                                                <td className="p-4 text-center font-bold text-emerald-600">{row.plusFeriado.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black text-xs uppercase print:bg-gray-200 print:text-black">
                            <tr>
                                <td className="p-4 text-right">TOTAL GENERAL</td>
                                <td className="p-4 text-center">{grandTotal.shifts}</td>
                                <td className="p-4 text-center text-emerald-400 print:text-black">{grandTotal.total.toFixed(1)}</td>
                                <td className="p-4 text-center">{grandTotal.diurnas.toFixed(1)}</td>
                                <td className="p-4 text-center text-violet-300 print:text-black">{grandTotal.nocturnas.toFixed(1)}</td>
                                <td className="p-4 text-center text-rose-400 print:text-black">{grandTotal.extra100.toFixed(1)}</td>
                                <td className="p-4 text-center text-emerald-400 print:text-black">{grandTotal.plusFeriado.toFixed(1)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const renderEmployeeTable = () => {
        const grandTotal = employeeReport.reduce((acc, curr) => ({
            shifts: acc.shifts + curr.shifts,
            total: acc.total + curr.total,
            diurnas: acc.diurnas + curr.diurnas,
            nocturnas: acc.nocturnas + curr.nocturnas,
            extra50: acc.extra50 + curr.extra50,
            extra100: acc.extra100 + curr.extra100,
            plusFeriado: acc.plusFeriado + curr.plusFeriado
        }), { shifts: 0, total: 0, diurnas: 0, nocturnas: 0, extra50: 0, extra100: 0, plusFeriado: 0 });

        return (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print-container">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 no-print">
                    <h3 className="font-black text-sm uppercase flex gap-2"><Users size={16}/> Liquidación de Horas</h3>
                    <div className="flex gap-2">
                        <button onClick={() => downloadCSV(employeeReport, 'reporte_empleados')} className="p-2 bg-white border rounded hover:bg-slate-100 text-slate-500"><Download size={16}/></button>
                        <button onClick={() => window.print()} className="p-2 bg-white border rounded hover:bg-slate-100 text-slate-500"><Printer size={16}/></button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Empleado</th>
                                <th className="p-4 text-center">Turnos</th>
                                <th className="p-4 text-center text-indigo-600">Total Hs</th>
                                <th className="p-4 text-center text-slate-400">Normales</th>
                                <th className="p-4 text-center text-amber-600">Ex 50%</th>
                                <th className="p-4 text-center text-rose-600">Ex 100%</th>
                                <th className="p-4 text-center text-violet-600">Noct.</th>
                                <th className="p-4 text-center text-emerald-600">Plus Feriado</th>
                                <th className="p-4 text-center no-print">Ver</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {employeeReport.map(row => (
                                <tr key={row.id} className="hover:bg-indigo-50/30 cursor-pointer group" onClick={() => setDetailItem(row)}>
                                    <td className="p-4 font-bold text-slate-700">
                                        {row.name}
                                        {(row.ftCount > 0 || row.ffCount > 0) && (
                                            <div className="flex gap-1 mt-1">
                                                {row.ftCount > 0 && <span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded border border-violet-200">FT: {row.ftCount}</span>}
                                                {row.ffCount > 0 && <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1 rounded border border-cyan-200">FF: {row.ffCount}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">{row.shifts}</td>
                                    <td className="p-4 text-center font-black text-indigo-600 text-lg">{row.total.toFixed(1)}</td>
                                    <td className="p-4 text-center text-slate-400">{row.diurnas.toFixed(1)}</td>
                                    <td className="p-4 text-center font-bold text-amber-600 bg-amber-50/30">{row.extra50.toFixed(1)}</td>
                                    <td className="p-4 text-center font-bold text-rose-600 bg-rose-50/30">{row.extra100.toFixed(1)}</td>
                                    <td className="p-4 text-center text-violet-600">{row.nocturnas.toFixed(1)}</td>
                                    <td className="p-4 text-center font-bold text-emerald-600">{row.plusFeriado.toFixed(1)}</td>
                                    <td className="p-4 text-center text-slate-300 group-hover:text-indigo-600 no-print"><ChevronRight size={16}/></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black text-xs uppercase print:bg-gray-200 print:text-black">
                            <tr>
                                <td className="p-4 text-right">TOTAL GENERAL</td>
                                <td className="p-4 text-center">{grandTotal.shifts}</td>
                                <td className="p-4 text-center text-emerald-400 print:text-black">{grandTotal.total.toFixed(1)}</td>
                                <td className="p-4 text-center text-slate-400 print:text-black">{grandTotal.diurnas.toFixed(1)}</td>
                                <td className="p-4 text-center text-amber-400 print:text-black">{grandTotal.extra50.toFixed(1)}</td>
                                <td className="p-4 text-center text-rose-400 print:text-black">{grandTotal.extra100.toFixed(1)}</td>
                                <td className="p-4 text-center text-violet-300 print:text-black">{grandTotal.nocturnas.toFixed(1)}</td>
                                <td className="p-4 text-center text-emerald-400 print:text-black">{grandTotal.plusFeriado.toFixed(1)}</td>
                                <td className="no-print"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const renderShiftsDetailTable = () => {
        const empData = employeeReport.find(e => e.id === selectedDetailEmployee);
        
        if (!selectedDetailEmployee) {
            return (
                <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 animate-in fade-in">
                    <User size={48} className="mx-auto mb-2 opacity-20"/>
                    <p className="font-bold uppercase text-sm">Seleccione un empleado para ver sus turnos</p>
                </div>
            );
        }

        if (!empData || !empData.rawShifts.length) {
            return (
                <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                    <p className="font-bold uppercase text-sm">No se encontraron turnos para este empleado en el rango seleccionado.</p>
                </div>
            );
        }

        const sortedShifts = [...empData.rawShifts].sort((a: any, b: any) => a.startTime.seconds - b.startTime.seconds);

        return (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print-container animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 no-print">
                    <h3 className="font-black text-sm uppercase flex gap-2 items-center">
                        <Calendar size={16} className="text-indigo-600"/> 
                        Cronograma: <span className="text-slate-700">{empData.name}</span>
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="p-2 bg-white border rounded hover:bg-slate-100 text-slate-500"><Printer size={16}/></button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Día</th>
                                <th className="p-4 text-center">Código</th>
                                <th className="p-4 text-center">Horario</th>
                                <th className="p-4">Objetivo</th>
                                <th className="p-4 text-center">Hs Calc.</th>
                                <th className="p-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {sortedShifts.map((s: any) => {
                                const dateObj = new Date(s.startTime.seconds * 1000);
                                const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
                                
                                let duration = (s.endTime.seconds - s.startTime.seconds) / 3600;
                                const rawCode = (s.code || '').trim().toUpperCase();
                                if (SHIFT_HOURS_LOOKUP[rawCode]) duration = SHIFT_HOURS_LOOKUP[rawCode];

                                return (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-700">{formatDate(s.startTime)}</td>
                                        <td className="p-4 capitalize text-slate-500 text-xs">{dayName}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${s.code === 'F' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                {s.code}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-mono text-xs text-slate-500">
                                            {formatTime(s.startTime)} - {formatTime(s.endTime)}
                                        </td>
                                        <td className="p-4 text-xs font-bold text-slate-600 truncate max-w-[200px]">
                                            {s.objectiveName || s.objectiveId}
                                        </td>
                                        <td className="p-4 text-center font-bold text-indigo-600">
                                            {duration > 0 ? duration.toFixed(1) : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {s.status === 'PRESENT' 
                                                ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">PRESENTE</span>
                                                : s.status === 'ABSENT'
                                                ? <span className="text-[9px] bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold">AUSENTE</span>
                                                : <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">PENDIENTE</span>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderDetailModal = () => {
        if (!detailItem) return null;

        // Nota: Si usas el mismo lógica de visualización que arriba, puedes reutilizarla.
        // Aquí mantengo tu estructura del modal para no romper el diseño.
        
        const rowsWithData = detailItem.rawShifts
            .sort((a:any,b:any) => a.startTime.seconds - b.startTime.seconds)
            .map((s:any) => {
                const rawCode = (s.code||'').trim().toUpperCase();
                const isOp = OPERATIVE_CODES.includes(rawCode);
                
                const start = new Date(s.startTime.seconds * 1000);
                const end = new Date(s.endTime.seconds * 1000);
                let duration = isOp ? (end.getTime() - start.getTime()) / 3600000 : 0;
                if (duration < 0 || duration > 24) duration = SHIFT_HOURS_LOOKUP[rawCode] || 8;
                
                const night = isOp ? getNightDuration(start, end) : 0;
                const day = duration - night;
                
                // Nota: Aquí se recalcula visualmente, pero los datos duros vienen del hook en `employeeReport`
                // Si quieres precisión absoluta, deberías pasarle el "holidayMap" al componente, 
                // pero para efectos visuales esto funciona bien si es consistente.
                
                const isFT = s.isFrancoTrabajado || rawCode === 'FT';
                const isFF = s.isFrancoCompensatorio || rawCode === 'FF';

                return {
                    id: s.id,
                    date: start,
                    code: rawCode,
                    swapWith: s.swapWith,
                    isOp,
                    total: duration,
                    day,
                    night,
                    h100: isFT ? duration : 0, 
                    hFeriado: 0, // Simplificación visual, el total real está en la tabla principal
                    isFT,
                    isFF
                };
            });

        const totalSum = rowsWithData.reduce((acc:any, curr:any) => ({
            total: acc.total + curr.total,
            day: acc.day + curr.day,
            night: acc.night + curr.night,
            h100: acc.h100 + curr.h100,
            hFeriado: acc.hFeriado + curr.hFeriado
        }), { total: 0, day: 0, night: 0, h100: 0, hFeriado: 0 });

        const horasParaBolsa = totalSum.total - totalSum.h100; 
        const excedente = Math.max(0, horasParaBolsa - 200);
        const horasSimples = Math.min(horasParaBolsa, 200);

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm no-print" onClick={() => setDetailItem(null)}>
                <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <div className="p-6 bg-slate-50 border-b flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DETALLE DE HORAS</p>
                            <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-2">
                                <Users size={24} className="text-indigo-600"/> {detailItem.name}
                            </h2>
                        </div>
                        <button onClick={() => setDetailItem(null)} className="p-2 bg-white rounded-full border hover:bg-slate-100"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50 p-6">
                        <table className="w-full text-sm text-left border-collapse bg-white shadow-sm rounded-xl overflow-hidden">
                            <thead className="text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 bg-slate-100">
                                <tr>
                                    <th className="py-3 px-4">Fecha</th>
                                    <th className="py-3 px-4">Horario</th>
                                    <th className="py-3 px-4 text-center">Tipo</th>
                                    <th className="py-3 px-4 text-center border-l border-slate-200">Hs Totales</th>
                                    <th className="py-3 px-4 text-center text-amber-600">Diurnas</th>
                                    <th className="py-3 px-4 text-center text-indigo-600">Nocturnas</th>
                                    <th className="py-3 px-4 text-center text-rose-600 border-l border-slate-200">Hs 100% (FT)</th>
                                    <th className="py-3 px-4 text-center">Obs.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rowsWithData.map((row:any) => (
                                    <tr key={row.id} className="hover:bg-indigo-50/50">
                                        <td className="py-3 px-4 font-bold text-slate-700">{formatDate({seconds: row.date.getTime()/1000})}</td>
                                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">{formatTime({seconds: row.date.getTime()/1000})}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${row.isFT ? 'bg-violet-100 text-violet-700 border-violet-200' : row.isFF ? 'bg-cyan-100 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-600'}`}>
                                                {row.code}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-black text-slate-800 border-l border-slate-100">{row.total > 0 ? row.total.toFixed(1) : '-'}</td>
                                        <td className="py-3 px-4 text-center font-mono text-amber-600"><div className="flex items-center justify-center gap-1">{row.day > 0 && <Sun size={10}/>} {row.day > 0 ? row.day.toFixed(1) : '-'}</div></td>
                                        <td className="py-3 px-4 text-center font-mono text-indigo-600"><div className="flex items-center justify-center gap-1">{row.night > 0 && <Moon size={10}/>} {row.night > 0 ? row.night.toFixed(1) : '-'}</div></td>
                                        <td className="py-3 px-4 text-center font-black text-rose-600 bg-rose-50/20 border-l border-slate-100">{row.h100 > 0 ? row.h100.toFixed(1) : '-'}</td>
                                        <td className="py-3 px-4 text-center">
                                            {row.swapWith && <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100">🔁 {row.swapWith}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white font-bold text-xs">
                                <tr>
                                    <td colSpan={3} className="py-4 px-4 text-right uppercase tracking-wider">Acumulado:</td>
                                    <td className="py-4 px-4 text-center font-black text-white text-sm border-l border-slate-700">{totalSum.total.toFixed(1)}</td>
                                    <td className="py-4 px-4 text-center text-amber-400">{totalSum.day.toFixed(1)}</td>
                                    <td className="py-4 px-4 text-center text-indigo-300">{totalSum.night.toFixed(1)}</td>
                                    <td className="py-4 px-4 text-center text-rose-400 font-black text-sm border-l border-slate-700">{totalSum.h100.toFixed(1)}</td>
                                    <td></td>
                                </tr>
                                <tr className="bg-slate-800 border-t border-slate-700">
                                    <td colSpan={3} className="py-3 px-4 text-right uppercase text-amber-400">Liquidación (200hs):</td>
                                    <td colSpan={3} className="py-3 px-4">
                                        <div className="flex justify-around items-center">
                                            <div className="flex flex-col items-center"><span className="text-[9px] text-slate-400 uppercase">Hs Simples</span><span className="text-white font-mono text-lg">{horasSimples.toFixed(1)}</span></div>
                                            <div className="h-8 w-px bg-slate-600"></div>
                                            <div className="flex flex-col items-center"><span className="text-[9px] text-amber-400 uppercase">Extras 50%</span><span className="text-amber-400 font-mono text-lg font-black">{excedente.toFixed(1)}</span></div>
                                        </div>
                                    </td>
                                    <td colSpan={3} className="py-3 px-4 text-center text-xs text-slate-500 italic border-l border-slate-700">* FT y Feriados se pagan aparte.</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <Head><title>Reportes | CronoApp</title></Head>
            <PrintStyles />
            <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center border-b pb-4 no-print">
                    <div><h1 className="text-2xl font-black uppercase text-slate-800">Centro de Reportes</h1><p className="text-sm text-slate-500 font-medium">Liquidación CCT 507/07</p></div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('EMPLOYEE')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'EMPLOYEE' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Liquidación</button>
                        <button onClick={() => setActiveTab('SHIFTS')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'SHIFTS' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Detalle Turnos</button>
                        <button onClick={() => setActiveTab('OBJECTIVE')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'OBJECTIVE' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Por Objetivo</button>
                        <button onClick={() => setActiveTab('AUDIT')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'AUDIT' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Auditoría</button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-wrap gap-4 items-end no-print">
                    <div className="flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Desde</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full p-2 border rounded-xl font-bold text-sm"/>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Hasta</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full p-2 border rounded-xl font-bold text-sm"/>
                    </div>

                    {activeTab === 'SHIFTS' && (
                        <div className="flex-[2] min-w-[250px] animate-in slide-in-from-left-5">
                            <label className="text-[10px] font-bold text-indigo-500 uppercase">Filtrar por Empleado</label>
                            <select 
                                value={selectedDetailEmployee} 
                                onChange={(e) => setSelectedDetailEmployee(e.target.value)}
                                className="w-full p-2.5 border-2 border-indigo-100 bg-indigo-50/30 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500"
                            >
                                <option value="">-- Seleccione un Empleado --</option>
                                {employeeReport.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button onClick={() => activeTab === 'AUDIT' ? loadAudit() : generateReports()} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-slate-800 transition-colors">
                        {loading ? 'Procesando...' : 'Generar Reporte'}
                    </button>
                </div>

                {activeTab === 'EMPLOYEE' && renderEmployeeTable()}
                {activeTab === 'SHIFTS' && renderShiftsDetailTable()}
                {activeTab === 'OBJECTIVE' && renderObjectiveTable()}
                
                {activeTab === 'AUDIT' && (
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th className="p-4">Fecha</th><th className="p-4">Actor</th><th className="p-4">Acción</th><th className="p-4">Detalle</th></tr></thead><tbody className="divide-y">{auditLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-4"><p className="font-bold">{formatDate(log.timestamp)}</p><p className="text-xs text-slate-400">{formatTime(log.timestamp)}</p></td><td className="p-4 font-bold text-indigo-600">{log.actorName || 'Sistema'}</td><td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black uppercase text-slate-600 border">{DICTIONARY[log.action] || log.action}</span></td><td className="p-4 text-xs text-slate-500 truncate max-w-xs">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</td></tr>))}</tbody></table>
                    </div>
                )}

                {renderDetailModal()}
            </div>
        </DashboardLayout>
    );
}