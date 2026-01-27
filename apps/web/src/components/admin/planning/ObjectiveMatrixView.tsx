import React, { useState, useEffect, useMemo } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { IShift } from '@/common/interfaces/shift.interface';
import { IEmployee } from '@/common/interfaces/employee.interface';
import { IObjective } from '@/common/interfaces/client.interface';
import { callManageData, callManageEmployees, db } from '@/services/firebase-client.service';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { RefreshCw, FileSpreadsheet, MapPin, FileDown, Printer } from 'lucide-react'; // Iconos nuevos
import Button from '@/components/common/Button';
import toast from 'react-hot-toast';

// Librerías de Exportación
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ObjectiveMatrixView() {
    const [loading, setLoading] = useState(false);
    const [objectives, setObjectives] = useState<IObjective[]>([]);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
    
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<IShift[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]);

    // 1. Cargar Objetivos
    useEffect(() => {
        const loadObj = async () => {
            try {
                const res = await callManageData({ action: 'GET_ALL_OBJECTIVES', payload: {} });
                const data = (res.data as any).data || [];
                setObjectives(data);
                if (data.length > 0) setSelectedObjectiveId(data[0].id);
            } catch (e) { console.error(e); }
        };
        loadObj();
    }, []);

    // 2. Cargar Datos
    const loadMatrixData = async () => {
        if (!selectedObjectiveId) return;
        setLoading(true);
        try {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);

            // A. Turnos
            const shiftsRef = collection(db, 'turnos');
            const q = query(
                shiftsRef,
                where('objectiveId', '==', selectedObjectiveId),
                where('startTime', '>=', Timestamp.fromDate(start)),
                where('startTime', '<=', Timestamp.fromDate(end))
            );
            const snap = await getDocs(q);
            const loadedShifts = snap.docs.map(d => ({ id: d.id, ...d.data() } as IShift));
            setShifts(loadedShifts);

            // B. Empleados
            const uniqueEmpIds = Array.from(new Set(loadedShifts.map(s => s.employeeId).filter(id => id !== 'VACANTE')));
            
            if (uniqueEmpIds.length > 0) {
                const obj = objectives.find(o => o.id === selectedObjectiveId);
                const empRes = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: { clientId: obj?.clientId } });
                const allEmps = (empRes.data as any).data as IEmployee[];
                setEmployees(allEmps.filter(e => uniqueEmpIds.includes(e.uid)));
            } else {
                setEmployees([]);
            }

        } catch (e: any) {
            toast.error("Error cargando matriz: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMatrixData();
    }, [selectedObjectiveId, currentDate]);

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate)
        });
    }, [currentDate]);

    // 3. Helper Visual (M, T, N, F)
    const getShiftVisual = (shift?: IShift) => {
        if (!shift) return { code: '', color: 'bg-white' };

        // Detección de Franco
        if ((shift.role && shift.role.toLowerCase().includes('franco')) || 
            (shift.employeeName && shift.employeeName.toLowerCase().includes('franco'))) {
            return { code: 'F', color: 'bg-slate-800 text-white font-bold' }; 
        }

        const startHour = shift.startTime instanceof Timestamp ? shift.startTime.toDate().getHours() : new Date(shift.startTime).getHours();

        if (startHour >= 6 && startHour < 14) return { code: 'M', color: 'bg-sky-200 text-sky-800 font-bold' };
        if (startHour >= 14 && startHour < 22) return { code: 'T', color: 'bg-amber-100 text-amber-800 font-bold' };
        if (startHour >= 22 || startHour < 6) return { code: 'N', color: 'bg-slate-700 text-white font-bold' };

        return { code: 'X', color: 'bg-gray-100' };
    };

    // --- 4. EXPORTAR EXCEL ---
    const handleExportExcel = () => {
        const objName = objectives.find(o => o.id === selectedObjectiveId)?.name || 'Cronograma';
        const monthStr = format(currentDate, 'MMMM_yyyy', { locale: es });
        
        // Encabezados
        const headers = ['Legajo', 'Apellido y Nombre', ...daysInMonth.map(d => format(d, 'dd')), 'Total Hs'];
        
        // Filas
        const dataRows = employees.map(emp => {
            let totalHours = 0;
            const daysData = daysInMonth.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd'); // 🛑 FIX ZONA HORARIA LOCAL
                const shift = shifts.find(s => {
                    const sDate = s.startTime instanceof Timestamp ? s.startTime.toDate() : new Date(s.startTime);
                    return format(sDate, 'yyyy-MM-dd') === dayKey && s.employeeId === emp.uid && s.status !== 'Canceled';
                });

                if (!shift) return '';
                const visual = getShiftVisual(shift);
                
                // Sumar horas si no es franco
                if (visual.code !== 'F') {
                    const start = shift.startTime instanceof Timestamp ? shift.startTime.toDate() : new Date(shift.startTime);
                    const end = shift.endTime instanceof Timestamp ? shift.endTime.toDate() : new Date(shift.endTime);
                    totalHours += (end.getTime() - start.getTime()) / 3600000;
                }
                return visual.code;
            });

            return [emp.fileNumber || '', emp.name, ...daysData, Math.round(totalHours)];
        });

        // Crear Libro
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            [`CRONOGRAMA: ${objName.toUpperCase()} - ${monthStr.toUpperCase()}`], // Título
            [], 
            headers, 
            ...dataRows
        ]);

        XLSX.utils.book_append_sheet(wb, ws, "Cronograma");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, `Cronograma_${objName}_${monthStr}.xlsx`);
    };

    // --- 5. EXPORTAR PDF ---
    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const objName = objectives.find(o => o.id === selectedObjectiveId)?.name || 'Cronograma';
        const monthStr = format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase();

        doc.setFontSize(14);
        doc.text(`CRONOGRAMA: ${objName} - ${monthStr}`, 14, 15);

        const head = [['Legajo', 'Nombre', ...daysInMonth.map(d => format(d, 'dd')), 'Hs']];
        
        const body = employees.map(emp => {
            let totalHours = 0;
            const row = [
                emp.fileNumber || '',
                emp.name,
                ...daysInMonth.map(day => {
                    const dayKey = format(day, 'yyyy-MM-dd'); // 🛑 FIX ZONA HORARIA LOCAL
                    const shift = shifts.find(s => {
                        const sDate = s.startTime instanceof Timestamp ? s.startTime.toDate() : new Date(s.startTime);
                        return format(sDate, 'yyyy-MM-dd') === dayKey && s.employeeId === emp.uid && s.status !== 'Canceled';
                    });
                    
                    if (!shift) return '';
                    const visual = getShiftVisual(shift);
                    if (visual.code !== 'F') {
                        const start = shift.startTime instanceof Timestamp ? shift.startTime.toDate() : new Date(shift.startTime);
                        const end = shift.endTime instanceof Timestamp ? shift.endTime.toDate() : new Date(shift.endTime);
                        totalHours += (end.getTime() - start.getTime()) / 3600000;
                    }
                    return visual.code;
                }),
                String(Math.round(totalHours)) // Convertir a string para autoTable
            ];
            // Push the totalHours as the last element of the row, correctly typed.
            row[row.length - 1] = String(Math.round(totalHours));
            return row;
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 20,
            styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' }, // Letra chica para que entre
            headStyles: { fillColor: [30, 41, 59] }, // Slate-800
            columnStyles: {
                0: { cellWidth: 15 }, // Legajo
                1: { cellWidth: 40, halign: 'left' }, // Nombre
                // El resto automático
            },
            theme: 'grid'
        });

        doc.save(`Cronograma_${objName}_${monthStr}.pdf`);
    };

    return (
        <div className="space-y-4">
            
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileSpreadsheet size={24}/></div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Matriz de Turnos</h2>
                        <p className="text-xs text-gray-500">Vista compacta mensual por objetivo.</p>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    <input 
                        type="month" 
                        className="border p-2 rounded-lg text-sm font-bold text-gray-700"
                        value={format(currentDate, 'yyyy-MM')}
                        onChange={(e) => setCurrentDate(new Date(e.target.value + '-01'))}
                    />

                    <div className="relative min-w-[250px]">
                        <select 
                            className="w-full appearance-none border border-gray-300 rounded-lg p-2 pl-3 pr-8 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={selectedObjectiveId}
                            onChange={(e) => setSelectedObjectiveId(e.target.value)}
                        >
                            {objectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <MapPin size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none"/>
                    </div>

                    <Button onClick={loadMatrixData} className="bg-white border hover:bg-gray-50 text-gray-600 p-2"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></Button>
                    
                    {/* BOTONES DE EXPORTACIÓN */}
                    <div className="h-8 w-px bg-gray-300 mx-1"></div>
                    <Button onClick={handleExportExcel} className="bg-emerald-600 text-white hover:bg-emerald-700 flex gap-2 items-center" title="Descargar Excel">
                        <FileDown size={18}/> Excel
                    </Button>
                    <Button onClick={handleExportPDF} className="bg-rose-600 text-white hover:bg-rose-700 flex gap-2 items-center" title="Imprimir PDF">
                        <Printer size={18}/> PDF
                    </Button>
                </div>
            </div>

            {/* TABLA MATRIZ */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white text-xs uppercase">
                            <th className="p-3 text-left w-48 font-bold border-r border-slate-600 sticky left-0 z-10 bg-slate-800">
                                {format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
                            </th>
                            {daysInMonth.map(d => (
                                <th key={d.toString()} className={`w-8 border-r border-slate-600 text-center ${[0,6].includes(getDay(d)) ? 'bg-slate-700' : ''}`}>
                                    {format(d, 'EEEEE', { locale: es })}
                                </th>
                            ))}
                            <th className="w-16 text-center bg-slate-900 font-bold">TOT</th>
                        </tr>
                        <tr className="bg-gray-100 text-gray-600 text-xs font-mono">
                            <th className="p-2 text-left border-r border-gray-300 sticky left-0 z-10 bg-gray-100 font-normal italic">
                                Legajo / Guardia
                            </th>
                            {daysInMonth.map(d => (
                                <th key={d.toString()} className="border-r border-gray-300 text-center border-b font-bold">
                                    {format(d, 'd')}
                                </th>
                            ))}
                            <th className="border-b bg-gray-200">Hs</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {employees.length === 0 && (
                            <tr><td colSpan={daysInMonth.length + 2} className="p-8 text-center text-gray-400 italic">No hay personal asignado en este período.</td></tr>
                        )}
                        
                        {/* Filas de Empleados */}
                        {employees.map(emp => {
                            let totalHours = 0;
                            return (
                                <tr key={emp.uid} className="border-b border-gray-200 hover:bg-indigo-50/30 transition-colors">
                                    <td className="p-2 border-r border-gray-200 font-medium text-gray-700 sticky left-0 z-10 bg-white">
                                        <div className="font-bold text-indigo-900 truncate max-w-[180px]">{emp.name}</div>
                                        <div className="text-[10px] text-gray-400">{emp.fileNumber || 'S/L'}</div>
                                    </td>
                                    {daysInMonth.map(day => {
                                        // 🛑 FIX: Usar format para evitar cambio de día por UTC
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        
                                        const shift = shifts.find(s => {
                                            const sDate = s.startTime instanceof Timestamp ? s.startTime.toDate() : new Date(s.startTime);
                                            // Comparamos strings locales
                                            return format(sDate, 'yyyy-MM-dd') === dayKey && s.employeeId === emp.uid && s.status !== 'Canceled';
                                        });

                                        const visual = getShiftVisual(shift);
                                        
                                        if (shift && visual.code !== 'F') {
                                            const start = shift.startTime instanceof Timestamp ? shift.startTime.toDate() : new Date(shift.startTime);
                                            const end = shift.endTime instanceof Timestamp ? shift.endTime.toDate() : new Date(shift.endTime);
                                            totalHours += (end.getTime() - start.getTime()) / 3600000;
                                        }

                                        return (
                                            <td key={dayKey} className="border-r border-gray-200 p-0 h-10 relative">
                                                {shift ? (
                                                    <div className={`w-full h-full flex items-center justify-center text-[10px] border-b border-white ${visual.color}`} title={`${visual.code}`}>
                                                        {visual.code}
                                                    </div>
                                                ) : null}
                                            </td>
                                        );
                                    })}
                                    <td className="border-l border-gray-300 bg-gray-50 text-center font-bold text-indigo-700">
                                        {Math.round(totalHours)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Referencias */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex gap-6 text-xs">
                <span className="font-bold text-gray-500 uppercase">Referencias:</span>
                <div className="flex items-center gap-2"><span className="w-4 h-4 bg-sky-200 block border"></span> Mañana (06-14)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 bg-amber-100 block border"></span> Tarde (14-22)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 bg-slate-700 block border"></span> Noche (22-06)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 bg-slate-800 block border"></span> Franco</div>
            </div>
        </div>
    );
}

