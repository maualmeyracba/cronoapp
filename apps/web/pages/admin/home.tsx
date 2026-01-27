import React, { useEffect, useState } from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
    Activity, AlertTriangle, Users, Calendar, ArrowRight, 
    ShieldAlert, FileEdit, Trash2, PlusCircle, MapPin, Copy, CheckCircle2
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions, db, callManageEmployees } from '@/services/firebase-client.service';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Llamadas a Cloud Functions
const callManageAudits = httpsCallable(functions, 'manageAudits');
const callManageSystemUsers = httpsCallable(functions, 'manageSystemUsers');

function HomePage() {
    const { user: currentUser } = useAuth();
    const [stats, setStats] = useState({ vacanciesToday: 0, activeStaff: 0, absentToday: 0, coverage: 0 });
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, [currentUser]);

    const loadDashboardData = async () => {
        try {
            // 1. CARGA DE NOMBRES (Prioridad: Mapa Global)
            const map: Record<string, string> = {};
            
            // A. Usuario Actual (Fallback inmediato)
            if (currentUser?.uid) {
                map[currentUser.uid] = currentUser.displayName || 'Tú (Admin)';
            }

            // B. Cargar Empleados (Guardias)
            try {
                const empRes = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: {} });
                (empRes.data as any).data?.forEach((u: any) => { if(u.uid) map[u.uid] = u.name; });
            } catch (e) { console.error("Error loading employees", e); }

            // C. Cargar Admins del Sistema
            try {
                const sysRes = await callManageSystemUsers({ action: 'GET_ALL_USERS', payload: {} });
                (sysRes.data as any).data?.forEach((u: any) => { if(u.uid) map[u.uid] = u.name; });
            } catch (e) { console.error("Error loading admins", e); }

            setUsersMap(map);

            // 2. KPIs (Estadísticas del día)
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
            
            // Turnos de hoy
            const shiftsRef = collection(db, 'turnos');
            const qShifts = query(shiftsRef, where('startTime', '>=', Timestamp.fromDate(todayStart)), where('startTime', '<=', Timestamp.fromDate(todayEnd)));
            const shiftsSnap = await getDocs(qShifts);
            
            let total = 0, assigned = 0, vacancies = 0;
            shiftsSnap.forEach(doc => { 
                const d = doc.data(); 
                if(d.status !== 'Canceled') { 
                    total++; 
                    if(d.employeeId === 'VACANTE') vacancies++; 
                    else assigned++; 
                } 
            });
            
            // Ausencias de hoy
            const absRef = collection(db, 'ausencias');
            const qAbs = query(absRef, where('endDate', '>=', Timestamp.fromDate(todayStart)), where('status', '==', 'APPROVED'));
            const absSnap = await getDocs(qAbs);

            setStats({ 
                vacanciesToday: vacancies, 
                activeStaff: assigned, 
                absentToday: absSnap.size, 
                coverage: total > 0 ? Math.round((assigned / total) * 100) : 0 
            });

            // 3. AUDITORÍA (Últimos 10 registros para el widget)
            const auditRes = await callManageAudits({ action: 'GET_GLOBAL_LOGS', payload: { limit: 10 } });
            setRecentLogs((auditRes.data as any).data || []);

        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
        }
    };

    // --- TRADUCTORES VISUALES (Iconos y Textos) ---
    const getLogIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <PlusCircle size={16} className="text-emerald-500"/>;
            case 'UPDATE': return <FileEdit size={16} className="text-blue-500"/>;
            case 'DELETE': return <Trash2 size={16} className="text-rose-500"/>;
            case 'CHECK_IN': return <MapPin size={16} className="text-purple-500"/>;
            case 'REPLICATE': return <Copy size={16} className="text-indigo-500"/>;
            default: return <Activity size={16} className="text-gray-500"/>;
        }
    };

    const renderLogMessage = (log: any) => {
        const d = log.details || {};
        
        if (log.action === 'CREATE') return <span className="text-gray-600">Creó un turno para <strong>{d.employee || 'Vacante'}</strong> en {d.objective}.</span>;
        if (log.action === 'DELETE') return <span className="text-gray-600">Eliminó un turno de <strong>{d.employee}</strong> ({new Date(d.date).toLocaleDateString()}).</span>;
        if (log.action === 'UPDATE') {
            let msg = "Actualizó un turno.";
            if (d.before?.start !== d.after?.start) msg = "Cambió el horario.";
            if (d.before?.emp !== d.after?.emp) msg = `Reasignó de ${d.before?.emp || 'Vacante'} a ${d.after?.emp || 'Vacante'}.`;
            return <span className="text-gray-600">{msg}</span>;
        }
        if (log.action === 'CHECK_IN') return <span className="text-gray-600">Fichó entrada vía App.</span>;
        if (log.action === 'REPLICATE') return <span className="text-gray-600">Replicación masiva ({d.count} turnos).</span>;

        return <span className="text-gray-400 italic">Acción: {log.action}</span>;
    };

    // Helper para obtener nombre (evita mostrar UID)
    const getUserName = (uid: string) => {
        if (usersMap[uid]) return usersMap[uid];
        if (currentUser?.uid === uid) return currentUser.displayName || 'Tú';
        return 'Usuario Desconocido';
    };

    return (
        <DashboardLayout title="Centro de Mando">
            <div className="space-y-6 p-2">
                
                {/* KPIs (Indicadores) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-gray-400 uppercase">Cobertura Hoy</p><h3 className={`text-2xl font-bold ${stats.coverage < 95 ? 'text-amber-500' : 'text-emerald-600'}`}>{stats.coverage}%</h3></div>
                        <div className={`p-3 rounded-lg ${stats.coverage < 95 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><Activity size={24}/></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-gray-400 uppercase">Vacantes Críticas</p><h3 className="text-2xl font-bold text-red-600">{stats.vacanciesToday}</h3></div>
                        <div className="p-3 rounded-lg bg-red-50 text-red-600"><AlertTriangle size={24}/></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-gray-400 uppercase">Guardias Activos</p><h3 className="text-2xl font-bold text-indigo-900">{stats.activeStaff}</h3></div>
                        <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600"><Users size={24}/></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-gray-400 uppercase">Ausencias / Lic</p><h3 className="text-2xl font-bold text-slate-700">{stats.absentToday}</h3></div>
                        <div className="p-3 rounded-lg bg-slate-100 text-slate-600"><Calendar size={24}/></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Accesos Rápidos */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gradient-to-r from-slate-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
                            <h2 className="text-xl font-bold mb-2">Bienvenido, {currentUser?.displayName || 'Admin'}</h2>
                            <p className="text-white/80 mb-6 text-sm">Seleccione una acción para comenzar su gestión operativa.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Link href="/admin/dashboard" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 p-4 rounded-xl transition flex items-center gap-3 group">
                                    <div className="bg-indigo-500 p-2 rounded-lg group-hover:scale-110 transition"><Calendar size={20}/></div>
                                    <div className="text-left"><span className="block font-bold text-sm">Planificador</span><span className="text-[10px] text-white/60">Grilla Interactiva</span></div>
                                </Link>
                                <Link href="/admin/planning/matrix" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 p-4 rounded-xl transition flex items-center gap-3 group">
                                    <div className="bg-emerald-500 p-2 rounded-lg group-hover:scale-110 transition"><Activity size={20}/></div>
                                    <div className="text-left"><span className="block font-bold text-sm">Matriz General</span><span className="text-[10px] text-white/60">Vista Sábana</span></div>
                                </Link>
                                <Link href="/admin/rrhh/novedades" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 p-4 rounded-xl transition flex items-center gap-3 group">
                                    <div className="bg-rose-500 p-2 rounded-lg group-hover:scale-110 transition"><AlertTriangle size={20}/></div>
                                    <div className="text-left"><span className="block font-bold text-sm">Novedades</span><span className="text-[10px] text-white/60">Cargar Licencias</span></div>
                                </Link>
                            </div>
                        </div>

                         {/* Estado del Sistema */}
                         <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600" size={18}/> Estado del Sistema</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Conexión a Base de Datos</span>
                                    <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">ESTABLE</span>
                                </div>
                                <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Motor de Reglas (Francos/Horas)</span>
                                    <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">ACTIVO</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actividad Reciente */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col h-full max-h-[600px]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-gray-700 text-sm uppercase flex items-center gap-2">
                                <ShieldAlert size={16} className="text-indigo-600"/> Actividad Reciente
                            </h3>
                            <Link href="/admin/audit" className="text-xs text-indigo-600 hover:underline flex items-center">Ver Historial <ArrowRight size={12} className="ml-1"/></Link>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {recentLogs.length === 0 && <p className="text-center text-gray-400 text-xs py-10">No hay movimientos recientes.</p>}
                            
                            {recentLogs.map((log, i) => {
                                const date = new Date(log.timestampIso);
                                const userName = getUserName(log.changedBy);
                                const userInitial = userName.charAt(0).toUpperCase();
                                
                                return (
                                    <div key={i} className="flex gap-3 relative group">
                                        {/* Línea conectora */}
                                        {i !== recentLogs.length - 1 && <div className="absolute left-[15px] top-8 bottom-[-20px] w-px bg-gray-200"></div>}
                                        
                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 z-10">
                                            {userInitial}
                                        </div>

                                        <div className="pb-1 w-full">
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-bold text-gray-900">{userName}</span>
                                                <span className="text-[9px] text-gray-400 whitespace-nowrap">
                                                    {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            
                                            <div className="text-xs mt-1 p-2 rounded-lg border border-transparent group-hover:border-slate-100 group-hover:bg-slate-50 transition-colors flex gap-2 items-start">
                                                <div className="mt-0.5 shrink-0">{getLogIcon(log.action)}</div>
                                                <div>{renderLogMessage(log)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}

// 🛑 FIX FINAL: Lista explícita de todos los roles de administración permitidos
export default withAuthGuard(HomePage, ['admin', 'SuperAdmin', 'Director', 'Scheduler']);

