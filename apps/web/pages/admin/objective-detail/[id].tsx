import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withAuthGuard } from '@/components/common/withAuthGuard'; 
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useClient } from '@/context/ClientContext';
import { 
    getObjectiveControlData, 
    getObjectiveContracts, 
    createServiceForObjective,
    updateServiceContract, 
    deleteServiceContract, 
    callScheduleShift,      
    callManageEmployees,
    getShiftTypes,
    createShiftType,
    updateShiftType,
    deleteShiftType,
    updateObjective,
    createPattern // 🛑 IMPORTANTE: Para automatizar la regla
} from '@/services/firebase-client.service';
import { IObjective, IServiceContract, IShiftType } from '@/common/interfaces/client.interface';
import { IShift } from '@/common/interfaces/shift.interface';
import { IEmployee } from '@/common/interfaces/employee.interface';
import toast from 'react-hot-toast';
import { GeocodingSelector } from '@/components/admin/GeocodingSelector';
import { 
    LayoutDashboard, Settings, MapPin, AlertTriangle, 
    Plus, Trash2, Edit2, FileText, Users, CalendarDays, Clock, Calculator, X 
} from 'lucide-react';

type TabView = 'operations' | 'config' | 'map';

function ObjectiveDetailPage() {
    const router = useRouter();
    const { id } = router.query;
    const { clients } = useClient();

    // Datos
    const [objective, setObjective] = useState<IObjective | null>(null);
    const [shifts, setShifts] = useState<IShift[]>([]);
    const [contracts, setContracts] = useState<IServiceContract[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]); 
    
    // UI
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabView>('operations');
    
    // Modales
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingContract, setEditingContract] = useState<IServiceContract | null>(null);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showModalitiesModal, setShowModalitiesModal] = useState(false);
    const [showEditObjectiveModal, setShowEditObjectiveModal] = useState(false);
    const [showGeoSelector, setShowGeoSelector] = useState(false);

    // Forms
    const [serviceForm, setServiceForm] = useState({ 
        name: '', 
        hours: 720, 
        isActive: true, 
        quantity: 1, 
        days: [0,1,2,3,4,5,6], // Default Lunes a Domingo
        startDate: '', 
        endDate: '' 
    });
    
    // 🛑 ESTADO PARA CÁLCULO PREDICTIVO
    const [serviceMetrics, setServiceMetrics] = useState({ totalVacancies: 0, estimatedHours: 0 });

    const [shiftForm, setShiftForm] = useState({ employeeId: '', start: '', end: '' });
    const [modalityForm, setModalityForm] = useState({ id: '', name: '', code: '', startTime: '07:00', durationHours: 12 });
    const [editObjForm, setEditObjForm] = useState({ name: '', address: '', clientId: '', latitude: '', longitude: '' });

    const [selectedContractForModalities, setSelectedContractForModalities] = useState<IServiceContract | null>(null);
    const [contractShiftTypes, setContractShiftTypes] = useState<IShiftType[]>([]);
    const [isEditingModality, setIsEditingModality] = useState(false);

    // --- CARGA DE DATOS ---
    const loadData = async () => {
        if (!id) return;
        try {
            const [controlData, contractData] = await Promise.all([
                getObjectiveControlData(id as string),
                getObjectiveContracts(id as string)
            ]);
            setObjective(controlData.objective);
            setShifts(controlData.shifts);
            setContracts(contractData);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const loadEmployees = async () => {
        try {
            const res = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: {} });
            setEmployees((res.data as any).data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        loadData();
        loadEmployees();
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, [id]);

    // 🛑 CALCULADORA EN TIEMPO REAL (Para Modal de Servicio)
    useEffect(() => {
        if (serviceForm.startDate && serviceForm.quantity) {
            const start = new Date(serviceForm.startDate);
            const end = serviceForm.endDate 
                ? new Date(serviceForm.endDate) 
                : new Date(start.getFullYear(), start.getMonth() + 1, 0); // Fin de mes default
            
            let workingDays = 0;
            // Iteramos para contar días hábiles según la selección
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (serviceForm.days.includes(d.getDay())) workingDays++;
            }
            
            // Estimación: Asumimos 24hs de cobertura por defecto para la proyección inicial
            // (Ya que aún no hay turnos definidos). O usamos 24 * quantity.
            const estimatedDailyHours = 24 * serviceForm.quantity; 
            
            setServiceMetrics({
                totalVacancies: workingDays * serviceForm.quantity, // Días * Dotación (simplificado)
                estimatedHours: workingDays * estimatedDailyHours
            });
        }
    }, [serviceForm]);


    // Helpers
    const getDateObj = (ts: any) => {
        if (!ts) return new Date();
        if (ts.toDate) return ts.toDate();
        if (ts instanceof Date) return ts;
        if (typeof ts === 'string') return new Date(ts);
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date();
    };
    const formatDate = (ts: any) => getDateObj(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    
    const renderDaysBadges = (days: number[]) => {
        const week = ['D','L','M','M','J','V','S'];
        if (days.length === 7) return <span className="text-xs text-green-600 font-medium">Todos los días (24x7)</span>;
        return (
            <div className="flex gap-0.5">
                {week.map((d, i) => (
                    <span key={i} className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-sm ${days.includes(i) ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-gray-50 text-gray-300'}`}>
                        {d}
                    </span>
                ))}
            </div>
        );
    };

    // KPIs Visuales
    const activeShifts = shifts.filter(s => s.status === 'InProgress');
    const upcomingShifts = shifts.filter(s => s.status === 'Assigned' && getDateObj(s.startTime) > new Date());
    const issueShifts = shifts.filter(s => s.status === 'Canceled' || (s.status === 'Assigned' && new Date() > getDateObj(s.startTime)));
    const hasAlerts = issueShifts.length > 0;

    // --- HANDLERS OBJETIVO ---
    const handleOpenEditObjective = () => {
        if (!objective) return;
        setEditObjForm({
            name: objective.name,
            address: objective.address,
            clientId: objective.clientId,
            latitude: String(objective.location.latitude),
            longitude: String(objective.location.longitude)
        });
        setShowEditObjectiveModal(true);
    };

    const handleSaveObjective = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!objective) return;
        const toastId = toast.loading("Actualizando...");
        try {
            await updateObjective(objective.id, {
                name: editObjForm.name,
                address: editObjForm.address,
                clientId: editObjForm.clientId,
                location: { latitude: parseFloat(editObjForm.latitude), longitude: parseFloat(editObjForm.longitude) }
            });
            toast.success("Sede actualizada", { id: toastId });
            setShowEditObjectiveModal(false);
            loadData();
        } catch (error: any) { toast.error(error.message, { id: toastId }); }
    };

    const handleGeoSelected = (lat: string, lng: string) => {
        setEditObjForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
        setShowGeoSelector(false);
    };

    // --- HANDLERS SERVICIO ---
    const handleSaveService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serviceForm.startDate) { toast.error("Fecha de inicio obligatoria"); return; }
        const toastId = toast.loading("Procesando...");
        try {
            const payload = {
                name: serviceForm.name,
                totalHours: serviceForm.hours,
                isActive: serviceForm.isActive,
                quantity: serviceForm.quantity,
                daysOfWeek: serviceForm.days,
                startDate: new Date(serviceForm.startDate).toISOString(),
                endDate: serviceForm.endDate ? new Date(serviceForm.endDate).toISOString() : undefined
            };
            if (editingContract) {
                await updateServiceContract(editingContract.id, payload);
                toast.success("Servicio actualizado", { id: toastId });
            } else {
                await createServiceForObjective({ objectiveId: id as string, ...payload as any });
                toast.success("Servicio creado", { id: toastId });
            }
            setShowServiceModal(false); setEditingContract(null); loadData();
        } catch (e: any) { toast.error(e.message, { id: toastId }); }
    };

    const handleDeleteService = async (contractId: string) => {
        if (!confirm("¿Eliminar servicio?")) return;
        try { await deleteServiceContract(contractId); toast.success("Eliminado"); loadData(); } catch (e: any) { toast.error(e.message); }
    };

    const openEditService = (c: IServiceContract) => {
        setEditingContract(c);
        const formatInput = (v: any) => v ? getDateObj(v).toISOString().split('T')[0] : '';
        setServiceForm({ 
            name: c.name, hours: c.totalHoursPerMonth, isActive: c.isActive,
            quantity: c.quantity || 1, days: c.daysOfWeek || [0,1,2,3,4,5,6],
            startDate: formatInput(c.startDate), endDate: formatInput(c.endDate)
        });
        setShowServiceModal(true); 
    };

    const openNewService = () => { 
        setEditingContract(null);
        const today = new Date().toISOString().split('T')[0];
        setServiceForm({ name: '', hours: 720, isActive: true, quantity: 1, days: [0,1,2,3,4,5,6], startDate: today, endDate: '' });
        setShowServiceModal(true); 
    };

    // --- HANDLERS MODALIDADES ---
    const openModalitiesManager = async (contract: IServiceContract) => {
        setSelectedContractForModalities(contract);
        const types = await getShiftTypes(contract.id);
        setContractShiftTypes(types);
        setModalityForm({ id: '', name: '', code: '', startTime: '07:00', durationHours: 12 });
        setIsEditingModality(false);
        setShowModalitiesModal(true);
    };

    // 🛑 LÓGICA DE ALTA DE MODALIDAD + PATRÓN AUTOMÁTICO
    const handleSaveModality = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContractForModalities) return;
        const toastId = toast.loading("Guardando...");
        try {
            if (isEditingModality) {
                await updateShiftType(modalityForm.id, { ...modalityForm });
                toast.success("Actualizado", { id: toastId });
            } else {
                // 1. Crear Tipo de Turno
                const res = await createShiftType({ contractId: selectedContractForModalities.id, color: '#4F46E5', ...modalityForm });
                const newShiftType = (res.data as any).data;

                // 2. Crear Patrón Automático (Usando datos del contrato padre)
                // Esto asegura que al ir al planificador ya existan reglas.
                const cStart = getDateObj(selectedContractForModalities.startDate);
                const cEnd = selectedContractForModalities.endDate ? getDateObj(selectedContractForModalities.endDate) : undefined;
                
                await createPattern({
                    contractId: selectedContractForModalities.id,
                    shiftTypeId: newShiftType.id,
                    daysOfWeek: selectedContractForModalities.daysOfWeek || [0,1,2,3,4,5,6],
                    quantity: 1, // Base 1 persona
                    validFrom: cStart.toISOString(),
                    validTo: cEnd?.toISOString()
                });
                toast.success("Modalidad y Regla creadas", { id: toastId });
            }
            
            const types = await getShiftTypes(selectedContractForModalities.id);
            setContractShiftTypes(types);
            
            if (!isEditingModality) setModalityForm({ id: '', name: '', code: '', startTime: '07:00', durationHours: 12 });
            setIsEditingModality(false);
        } catch (e: any) { toast.error(e.message, { id: toastId }); }
    };

    const handleEditModality = (m: IShiftType) => {
        setModalityForm({ id: m.id, name: m.name, code: m.code, startTime: m.startTime, durationHours: m.durationHours });
        setIsEditingModality(true);
    };

    const handleDeleteModality = async (id: string) => {
        if (!confirm("¿Borrar?")) return;
        await deleteShiftType(id);
        if (selectedContractForModalities) {
            const types = await getShiftTypes(selectedContractForModalities.id);
            setContractShiftTypes(types);
        }
    };

    // --- HANDLER TURNO MANUAL ---
    const handleCreateShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!objective) return;
        const emp = employees.find(e => e.uid === shiftForm.employeeId);
        if (!emp) return toast.error("Seleccione empleado");
        const toastId = toast.loading("Asignando...");
        try {
            await callScheduleShift({
                employeeId: emp.uid, employeeName: emp.name,
                objectiveId: objective.id, objectiveName: objective.name,
                startTime: new Date(shiftForm.start), endTime: new Date(shiftForm.end),
                status: 'Assigned'
            });
            toast.success("Turno creado", { id: toastId });
            setShowShiftModal(false); loadData();
        } catch (e: any) { toast.error(e.message, { id: toastId }); }
    };

    if (loading) return <DashboardLayout title="Cargando...">Loading...</DashboardLayout>;
    if (!objective) return <DashboardLayout title="Error">404 - Objetivo no encontrado</DashboardLayout>;

    return (
        <DashboardLayout title={`Torre: ${objective.name}`}>
            <div className="space-y-6">
                
                {/* Header */}
                <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-colors duration-500 ${hasAlerts ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-slate-800 to-indigo-900'}`}>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-bold">{objective.name}</h2>
                                <button onClick={handleOpenEditObjective} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition border border-white/30" title="Editar Sede"><Edit2 size={18} /></button>
                                {hasAlerts && <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold animate-pulse">ALERTA</span>}
                            </div>
                            <p className="text-white/80 flex items-center text-sm"><MapPin className="w-4 h-4 mr-1" /> {objective.address}</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-center min-w-[100px]"><p className="text-xs text-white/70 font-bold uppercase">En Servicio</p><p className="text-2xl font-bold">{activeShifts.length}</p></div>
                            <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-center min-w-[100px]"><p className="text-xs text-white/70 font-bold uppercase">Pendientes</p><p className="text-2xl font-bold">{upcomingShifts.length}</p></div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button onClick={() => setActiveTab('operations')} className={`px-6 py-3 border-b-2 flex gap-2 ${activeTab === 'operations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}><LayoutDashboard size={18} /> Operaciones</button>
                    <button onClick={() => setActiveTab('config')} className={`px-6 py-3 border-b-2 flex gap-2 ${activeTab === 'config' ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}><Settings size={18} /> Configuración</button>
                </div>

                {/* OPERATIONS */}
                {activeTab === 'operations' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button onClick={() => setShowShiftModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold shadow-sm"><Plus size={18} /> Asignar Turno Manual</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-5 py-3 border-b bg-green-50"><h3 className="font-bold text-green-800">En Servicio</h3></div>
                                <div className="divide-y">
                                    {activeShifts.length === 0 && <p className="p-4 text-center text-gray-400">Sin actividad.</p>}
                                    {activeShifts.map(s => <div key={s.id} className="p-4 flex justify-between"><span className="font-bold">{s.employeeName}</span><span className="font-mono text-green-700">{formatDate(s.checkInTime)}</span></div>)}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-5 py-3 border-b bg-blue-50"><h3 className="font-bold text-blue-800">Próximos</h3></div>
                                <div className="divide-y">
                                    {upcomingShifts.length === 0 && <p className="p-4 text-center text-gray-400">Sin ingresos.</p>}
                                    {upcomingShifts.map(s => <div key={s.id} className="p-4 flex justify-between"><span className="font-medium">{s.employeeName}</span><span className="font-mono text-indigo-600">{formatDate(s.startTime)}</span></div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIG (SERVICIOS) */}
                {activeTab === 'config' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Servicios Contratados</h3>
                            <button onClick={openNewService} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex gap-2"><Plus size={18} /> Nuevo Servicio</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {contracts.map(c => (
                                <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-all">
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditService(c)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteService(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                                    </div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={20} /></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 leading-tight">{c.name}</h4>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'ACTIVO' : 'INACTIVO'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg">
                                        <div className="flex justify-between"><span className="flex items-center gap-2 text-xs uppercase font-bold text-slate-400"><Users size={14}/> Dotación</span><span className="font-bold">{c.quantity || 1} Pers.</span></div>
                                        <div className="flex justify-between"><span className="flex items-center gap-2 text-xs uppercase font-bold text-slate-400"><CalendarDays size={14}/> Cobertura</span><div className="flex gap-0.5">{renderDaysBadges(c.daysOfWeek || [])}</div></div>
                                        <div className="flex justify-between"><span className="flex items-center gap-2 text-xs uppercase font-bold text-slate-400"><Clock size={14}/> Total</span><span className="font-bold">{c.totalHoursPerMonth} hs</span></div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-100">
                                        <button onClick={() => openModalitiesManager(c)} className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition text-center block">Gestionar Turnos Base</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MODAL EDITAR OBJETIVO */}
                {showEditObjectiveModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold mb-4">Editar Sede</h3>
                            <form onSubmit={handleSaveObjective} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Cliente</label>
                                    <select className="w-full border p-2 rounded bg-white" value={editObjForm.clientId} onChange={e => setEditObjForm({...editObjForm, clientId: e.target.value})} required>
                                        <option value="" disabled>Seleccione...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
                                    </select>
                                </div>
                                <input className="w-full border p-2 rounded" value={editObjForm.name} onChange={e => setEditObjForm({...editObjForm, name: e.target.value})} placeholder="Nombre" required />
                                <input className="w-full border p-2 rounded" value={editObjForm.address} onChange={e => setEditObjForm({...editObjForm, address: e.target.value})} placeholder="Dirección" required />
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="w-full border p-2 rounded bg-gray-50" value={editObjForm.latitude} readOnly />
                                    <input className="w-full border p-2 rounded bg-gray-50" value={editObjForm.longitude} readOnly />
                                </div>
                                <button type="button" onClick={() => setShowGeoSelector(true)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold">Actualizar Mapa</button>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <button type="button" onClick={() => setShowEditObjectiveModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                <GeocodingSelector address={editObjForm.address} isOpen={showGeoSelector} onClose={() => setShowGeoSelector(false)} onCoordinatesSelected={handleGeoSelected} />

                {/* MODAL SERVICIO (CON CALCULADORA PREDICTIVA) */}
                {showServiceModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold mb-4">{editingContract ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                            
                            {/* 🛑 PANEL PREDICTIVO */}
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200 mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calculator size={12}/> Estimación</p>
                                    <p className="text-2xl font-bold text-indigo-700 leading-none">{serviceMetrics.estimatedHours} <span className="text-xs font-normal text-slate-500">hs/mes</span></p>
                                    <p className="text-[10px] text-slate-400 mt-1">~{serviceMetrics.totalVacancies} vacantes proyectadas</p>
                                </div>
                                <div className={`text-2xl font-bold ${serviceMetrics.estimatedHours > serviceForm.hours ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {serviceMetrics.estimatedHours > serviceForm.hours ? '⚠' : '✓'}
                                </div>
                            </div>

                            <form onSubmit={handleSaveService} className="space-y-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre</label><input className="w-full border p-2 rounded" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} required /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Horas/Mes (Venta)</label><input className="w-full border p-2 rounded" type="number" value={serviceForm.hours} onChange={e => setServiceForm({...serviceForm, hours: +e.target.value})} required /></div>
                                    <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Dotación Simultánea</label><input className="w-full border p-2 rounded" type="number" min="1" value={serviceForm.quantity} onChange={e => setServiceForm({...serviceForm, quantity: +e.target.value})} required /></div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded border border-slate-100 grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase block">Inicio Contrato</label><input type="date" className="w-full border p-1 rounded text-sm" value={serviceForm.startDate} onChange={e => setServiceForm({...serviceForm, startDate: e.target.value})} required /></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase block">Fin (Opcional)</label><input type="date" className="w-full border p-1 rounded text-sm" value={serviceForm.endDate} onChange={e => setServiceForm({...serviceForm, endDate: e.target.value})} /></div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Días Operativos</label>
                                    <div className="flex justify-between gap-1">
                                        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day, index) => {
                                            const isSelected = serviceForm.days.includes(index);
                                            return <button key={index} type="button" onClick={() => setServiceForm(p => ({...p, days: isSelected ? p.days.filter(d => d !== index) : [...p.days, index].sort() }))} className={`w-8 h-8 rounded text-xs font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{day.charAt(0)}</button>
                                        })}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button type="button" onClick={() => setShowServiceModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL MODALIDADES */}
                {showModalitiesModal && selectedContractForModalities && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-2xl h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <div><h3 className="text-lg font-bold">Modalidades</h3><p className="text-xs text-gray-500">{selectedContractForModalities.name}</p></div>
                                <button onClick={() => setShowModalitiesModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto mb-4 space-y-2 p-1">
                                {contractShiftTypes.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                                        <div><p className="font-bold text-sm">{t.name} <span className="text-gray-400 text-xs">({t.code})</span></p><p className="text-xs text-indigo-600 font-mono">{t.startTime} • {t.durationHours}hs</p></div>
                                        <div className="flex gap-2"><button onClick={() => handleEditModality(t)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Edit2 size={14}/></button><button onClick={() => handleDeleteModality(t.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSaveModality} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">{isEditingModality ? 'Editar' : 'Nueva'}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                    <input placeholder="Nombre" className="border p-2 rounded text-sm" value={modalityForm.name} onChange={e => setModalityForm({...modalityForm, name: e.target.value})} required />
                                    <input placeholder="Código" className="border p-2 rounded text-sm" value={modalityForm.code} onChange={e => setModalityForm({...modalityForm, code: e.target.value})} required />
                                    <input type="time" className="border p-2 rounded text-sm" value={modalityForm.startTime} onChange={e => setModalityForm({...modalityForm, startTime: e.target.value})} required />
                                    <input type="number" placeholder="Duración" className="border p-2 rounded text-sm" value={modalityForm.durationHours} onChange={e => setModalityForm({...modalityForm, durationHours: +e.target.value})} required />
                                </div>
                                <div className="flex justify-end gap-2">
                                    {isEditingModality && <button type="button" onClick={() => { setIsEditingModality(false); setModalityForm({ id: '', name: '', code: '', startTime: '07:00', durationHours: 12 }); }} className="text-xs text-gray-500 underline">Cancelar</button>}
                                    <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black">{isEditingModality ? 'Actualizar' : 'Agregar'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL TURNO MANUAL */}
                {showShiftModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold mb-4">Asignación Manual</h3>
                            <form onSubmit={handleCreateShift} className="space-y-4">
                                <select className="w-full border p-2 rounded" value={shiftForm.employeeId} onChange={e => setShiftForm({...shiftForm, employeeId: e.target.value})} required>
                                    <option value="">Seleccione Empleado</option>
                                    {employees.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="datetime-local" className="border p-2 rounded" value={shiftForm.start} onChange={e => setShiftForm({...shiftForm, start: e.target.value})} required />
                                    <input type="datetime-local" className="border p-2 rounded" value={shiftForm.end} onChange={e => setShiftForm({...shiftForm, end: e.target.value})} required />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button type="button" onClick={() => setShowShiftModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Asignar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

export default withAuthGuard(ObjectiveDetailPage, ['admin', 'manager', 'supervisor']);



