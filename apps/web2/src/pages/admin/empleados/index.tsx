
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { employeeService, Employee } from '@/services/employeeService';
import { auditService } from '@/services/auditService'; // <--- IMPORTANTE
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/context/ToastContext';
import { 
  Users, Search, Plus, Edit2, Trash2, Phone, Mail, 
  FileBadge, UserCheck, UserX, AlertCircle, MapPin, Building2
} from 'lucide-react';

export default function EmployeesPage() {
  const { addToast } = useToast();
  const [view, setView] = useState<'list' | 'form'>('list');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [allObjectives, setAllObjectives] = useState<any[]>([]);
  const [filteredObjectives, setFilteredObjectives] = useState<any[]>([]);

  const initialForm: any = {
    firstName: '', lastName: '', dni: '', fileNumber: '', 
    phone: '', email: '', category: 'Vigilador', status: 'active',
    laborAgreement: 'SUVICO',
    preferredClientId: '', preferredObjectiveId: ''
  };

  const [form, setForm] = useState<any>(initialForm);

  useEffect(() => { loadData(); loadClientsAndObjectives(); }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredEmployees(employees.filter(e => 
      e.lastName.toLowerCase().includes(term) || 
      e.firstName.toLowerCase().includes(term) ||
      e.fileNumber.includes(term)
    ));
  }, [searchTerm, employees]);

  useEffect(() => {
      if (form.preferredClientId) {
          const objs = allObjectives.filter(o => o.clientId === form.preferredClientId);
          setFilteredObjectives(objs);
      } else {
          setFilteredObjectives([]);
      }
  }, [form.preferredClientId, allObjectives]);

  const loadData = async () => {
    const data = await employeeService.getAll();
    setEmployees(data);
  };

  const loadClientsAndObjectives = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'clients'));
        const cList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(cList);

        const sSnap = await getDocs(query(collection(db, 'servicios_sla'), where('status', '==', 'active')));
        const oList = sSnap.docs.map(d => {
            const data = d.data();
            return { id: data.objectiveId, name: data.objectiveName, clientId: data.clientId };
        });
        const uniqueObjectives = Array.from(new Map(oList.map(item => [item.id, item])).values());
        setAllObjectives(uniqueObjectives);
      } catch (e) { console.error("Error cargando clientes/objetivos", e); }
  };

  const handleSave = async () => {
    if (!form.lastName || !form.firstName || !form.dni) return addToast('Datos incompletos', 'error');
    try {
      if (isEditing && form.id) {
        await employeeService.update(form.id, form);
        await auditService.log('EDICION_EMPLEADO', 'RRHH', { id: form.id, ...form }); // <--- AUDITORÍA
        addToast('Legajo actualizado', 'success');
      } else {
        const id = await employeeService.add({ ...form, createdAt: new Date().toISOString() });
        await auditService.log('ALTA_EMPLEADO', 'RRHH', { ...form, id }); // <--- AUDITORÍA
        addToast('Legajo creado', 'success');
      }
      loadData();
      setView('list');
    } catch (e) { addToast('Error al guardar', 'error'); }
  };

  const handleDelete = async (id: string) => {
    if(confirm('¿Eliminar legajo?')) {
      const empToDelete = employees.find(e => e.id === id); // Capturar datos antes de borrar
      await auditService.log('BAJA_EMPLEADO', 'RRHH', { ...empToDelete }); // <--- AUDITORÍA
      
      await employeeService.delete(id);
      loadData();
      addToast('Legajo eliminado', 'info');
    }
  };

  const openNew = () => { setForm(initialForm); setIsEditing(false); setView('form'); };
  const openEdit = (emp: any) => { setForm(emp); setIsEditing(true); setView('form'); };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Personal</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestión de Legajos y Dotación.</p>
          </div>
          {view === 'list' && (
            <button onClick={openNew} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all flex gap-2"><Plus size={16}/> Nuevo Legajo</button>
          )}
        </header>

        {view === 'list' && (
          <>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 flex items-center gap-4 shadow-sm">
              <Search className="text-slate-400"/>
              <input placeholder="Buscar por Nombre, Apellido o Legajo..." className="w-full bg-transparent outline-none font-bold text-slate-700 dark:text-white uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
              <div className="text-xs font-black text-slate-300 uppercase px-4 border-l dark:border-slate-700">{filteredEmployees.length} Pax</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map(emp => (
                <div key={emp.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border dark:border-slate-700 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                   <div className={`absolute top-0 right-0 p-4 ${emp.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {emp.status === 'active' ? <UserCheck size={18}/> : <UserX size={18}/>}
                   </div>
                   <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-black text-slate-500 dark:text-slate-300 text-xl">
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 dark:text-white uppercase leading-tight">{emp.lastName}</h3>
                        <p className="font-bold text-slate-500 text-sm uppercase">{emp.firstName}</p>
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded font-black uppercase mt-1 inline-block">{emp.category}</span>
                      </div>
                   </div>
                   <div className="space-y-2 border-t dark:border-slate-700 pt-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"><FileBadge size={14}/> Legajo: {emp.fileNumber || 'S/N'}</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"><MapPin size={14}/> Objetivo: {(allObjectives.find(o => o.id === emp.preferredObjectiveId)?.name) || 'Sin asignar'}</div>
                   </div>
                   <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button onClick={() => openEdit(emp)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-indigo-600 hover:scale-110"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(emp.id!)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-rose-600 hover:scale-110"><Trash2 size={14}/></button>
                   </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'form' && (
           <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border dark:border-slate-700 animate-in slide-in-from-right-4">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{isEditing ? 'Editar Legajo' : 'Alta de Personal'}</h2>
                  <button onClick={() => setView('list')} className="text-slate-400 font-bold uppercase text-xs">Cancelar</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre</label><input className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Apellido</label><input className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">DNI</label><input className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})}/></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Legajo</label><input className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.fileNumber} onChange={e => setForm({...form, fileNumber: e.target.value})}/></div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoría</label>
                    <select className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                        <option value="Vigilador">Vigilador</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Monitoreo">Monitoreo</option>
                        <option value="Custodia">Custodia</option>
                    </select>
                 </div>
              </div>

              {/* DOTACIÓN FIJA */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border dark:border-slate-700 mb-6">
                  <h3 className="text-sm font-black uppercase text-indigo-500 mb-4 flex items-center gap-2"><MapPin size={16}/> Dotación Fija (Objetivo Preferido)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cliente</label>
                        <select className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.preferredClientId || ''} onChange={e => setForm({...form, preferredClientId: e.target.value, preferredObjectiveId: ''})}>
                            <option value="">- Sin Asignar -</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.razonSocial}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Objetivo</label>
                        <select className="w-full p-4 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-2xl font-bold" value={form.preferredObjectiveId || ''} onChange={e => setForm({...form, preferredObjectiveId: e.target.value})} disabled={!form.preferredClientId}>
                            <option value="">- Sin Asignar -</option>
                            {filteredObjectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                  </div>
              </div>

              <div className="flex justify-end pt-6 border-t dark:border-slate-700">
                 <button onClick={handleSave} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-xs shadow-xl hover:scale-105 transition-transform">Guardar Legajo</button>
              </div>
           </div>
        )}
      </div>
    </DashboardLayout>
  );
}
