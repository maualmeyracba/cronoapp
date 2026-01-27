import React, { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db, callManageEmployees } from '@/services/firebase-client.service';
import { Calendar } from 'lucide-react';

export default function MonthlyRosterPage() {
  const [currentMonth] = useState(new Date());
  const monthDays = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const days = [];
    while (d.getMonth() === currentMonth.getMonth()) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  }, [currentMonth]);

  const { data: employees = [] } = useQuery({ queryKey: ['roster-emps-final'], queryFn: async () => {
    const res: any = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: {} });
    return (res.data as any).data || [];
  }});

  const { data: shifts = [] } = useQuery({ queryKey: ['roster-shifts-real'], queryFn: async () => {
    const snap = await getDocs(collection(db, 'turnos'));
    return snap.docs.map(d => d.data());
  }});

  return (
    <DashboardLayout title="Cronograma Roster Mensual">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl h-[calc(100vh-140px)] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-white"><h2 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Calendar size={16} className="text-indigo-600"/> {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()}</h2></div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase border-r sticky left-0 bg-slate-50">Legajo</th>
                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase border-r sticky left-[80px] bg-slate-50 shadow-md w-64">Nombre</th>
                {monthDays.map(d => <th key={d.getDate()} className="px-1 py-4 text-center text-[9px] font-black text-slate-400 border-b min-w-[32px]">{d.getDate()}</th>)}
                <th className="px-4 py-4 text-center text-[9px] font-black text-indigo-600 uppercase border-l bg-slate-50">Hs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp: any) => {
                let totalHs = 0;
                const name = (emp.lastName + ', ' + emp.firstName).toUpperCase();
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 border-r text-[10px] font-bold text-slate-400 sticky left-0 bg-white">{emp.legajo || '---'}</td>
                    <td className="px-6 py-4 border-r text-[10px] font-black text-slate-700 sticky left-[80px] bg-white uppercase truncate">{name}</td>
                    {monthDays.map(day => {
                      const s = shifts.find((sh: any) => sh.employeeName === name && new Date(sh.startTime instanceof Timestamp ? sh.startTime.toDate() : sh.startTime).toDateString() === day.toDateString());
                      if (s) totalHs += (s.durationHours || 8);
                      return <td key={day.getDate()} className="p-1 border-r border-slate-50 text-center text-[11px] font-black">{s ? (s.type ? s.type[0] : 'M') : <span className="text-slate-100">F</span>}</td>;
                    })}
                    <td className="px-4 py-4 text-center text-[10px] font-black text-indigo-600 border-l bg-slate-50/30">{totalHs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}