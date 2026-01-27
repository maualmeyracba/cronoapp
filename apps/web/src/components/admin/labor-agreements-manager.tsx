import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions'; 
import { functions } from '@/services/firebase-client.service';
import InputField from '@/components/common/InputField';
import Button from '@/components/common/Button';
import toast from 'react-hot-toast';
import { Edit2, Trash2, Plus, Briefcase, Clock, Moon, DownloadCloud } from 'lucide-react';

const callManageAgreements = httpsCallable(functions, 'manageAgreements');

export function LaborAgreementsManager() {
    const [agreements, setAgreements] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        id: '',
        name: '', code: '', 
        maxHoursWeekly: 48, maxHoursMonthly: 204, overtimeThresholdDaily: 12,
        saturdayCutoffHour: 13, nightShiftStart: 21, nightShiftEnd: 6
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await callManageAgreements({ action: 'GET_ALL', payload: {} });
            setAgreements((res.data as any).data || []);
        } catch (e) { console.error(e); toast.error("Error cargando convenios"); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    // 🛑 FUNCIÓN DE IMPORTACIÓN
    const handleInitialize = async () => {
        const toastId = toast.loading("Importando convenios estándar...");
        try {
            const res = await callManageAgreements({ action: 'INITIALIZE_DEFAULTS', payload: {} });
            toast.success((res.data as any).message, { id: toastId });
            loadData();
        } catch (e: any) {
            toast.error(e.message, { id: toastId });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading("Guardando...");
        try {
            if (isEditing) {
                await callManageAgreements({ action: 'UPDATE', payload: { id: formData.id, data: formData } });
            } else {
                await callManageAgreements({ action: 'CREATE', payload: formData });
            }
            toast.success("Guardado correctamente", { id: toastId });
            setShowModal(false);
            loadData();
        } catch (e: any) { toast.error(e.message, { id: toastId }); }
    };

    const handleEdit = (item: any) => {
        setFormData(item);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if(!confirm("¿Eliminar convenio?")) return;
        try {
            await callManageAgreements({ action: 'DELETE', payload: { id } });
            toast.success("Eliminado");
            loadData();
        } catch(e: any) { toast.error(e.message); }
    }

    const handleNew = () => {
        setFormData({ id: '', name: '', code: '', maxHoursWeekly: 48, maxHoursMonthly: 204, overtimeThresholdDaily: 12, saturdayCutoffHour: 13, nightShiftStart: 21, nightShiftEnd: 6 });
        setIsEditing(false);
        setShowModal(true);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div>
                    <h3 className="font-bold text-xl text-gray-800">Reglas Laborales Activas</h3>
                    <p className="text-sm text-gray-500">Define los límites y parámetros de liquidación.</p>
                </div>
                <div className="flex gap-3">
                    {/* Botón de Carga Inicial si está vacío */}
                    {agreements.length === 0 && !loading && (
                        <Button onClick={handleInitialize} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <DownloadCloud size={16}/> Cargar Estándares
                        </Button>
                    )}
                    <Button onClick={handleNew} primary className="flex items-center gap-2"><Plus size={16}/> Nuevo Convenio</Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agreements.map(a => (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-lg text-indigo-700">{a.name}</h4>
                                <span className="text-xs font-mono bg-white border px-2 py-0.5 rounded text-slate-500">{a.code}</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(a)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        
                        <div className="p-5 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2"><Briefcase size={14}/> Semanal</span>
                                <span className="font-bold text-gray-800">{a.maxHoursWeekly} hs</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2"><Clock size={14}/> Mensual</span>
                                <span className="font-bold text-gray-800">{a.maxHoursMonthly} hs</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2"><Moon size={14}/> Nocturnidad</span>
                                <span className="font-bold text-gray-800">{a.nightShiftStart}:00 - {a.nightShiftEnd}:00</span>
                            </div>
                        </div>
                    </div>
                ))}
                
                {agreements.length === 0 && !loading && (
                    <div className="col-span-full p-12 text-center text-gray-400 border-2 border-dashed rounded-xl">
                        No hay convenios cargados. Usa el botón "Cargar Estándares" para iniciar.
                    </div>
                )}
            </div>

            {/* Modal de Edición (Igual al anterior) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl w-full max-w-lg shadow-2xl">
                        <h3 className="text-xl font-bold mb-6 text-gray-800">{isEditing ? 'Editar Regla' : 'Nueva Regla Laboral'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <InputField label="Nombre (Ej: Seguridad Privada)" id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                                </div>
                                <InputField label="Código (Ej: SUVICO)" id="code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required />
                                <InputField label="Límite Diario (Ej: 12)" type="number" id="daily" value={formData.overtimeThresholdDaily} onChange={e => setFormData({...formData, overtimeThresholdDaily: +e.target.value})} required />
                                <InputField label="Max Semanal (Ej: 48)" type="number" id="weekly" value={formData.maxHoursWeekly} onChange={e => setFormData({...formData, maxHoursWeekly: +e.target.value})} required />
                                <InputField label="Max Mensual (Ej: 204)" type="number" id="monthly" value={formData.maxHoursMonthly} onChange={e => setFormData({...formData, maxHoursMonthly: +e.target.value})} required />
                                
                                <div className="col-span-2 border-t pt-4 mt-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Extras y Nocturnidad</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <InputField label="Corte Sáb." type="number" id="sat" value={formData.saturdayCutoffHour} onChange={e => setFormData({...formData, saturdayCutoffHour: +e.target.value})} required />
                                        <InputField label="Inicio Noche" type="number" id="ns" value={formData.nightShiftStart} onChange={e => setFormData({...formData, nightShiftStart: +e.target.value})} required />
                                        <InputField label="Fin Noche" type="number" id="ne" value={formData.nightShiftEnd} onChange={e => setFormData({...formData, nightShiftEnd: +e.target.value})} required />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                                <Button type="submit" primary>Guardar Regla</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}



