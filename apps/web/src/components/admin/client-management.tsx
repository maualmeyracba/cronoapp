import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { callManageHierarchy } from '@/services/firebase-client.service';
import { IClient } from '@/common/interfaces/client.interface';
import InputField from '@/components/common/InputField';
import SelectField from '@/components/common/SelectField';
import Button from '@/components/common/Button';
import { useClient } from '@/context/ClientContext'; // Para recargar el contexto global al cambiar algo

export function ClientManagement() {
  const { setClient } = useClient(); // Usamos esto para forzar recarga si es necesario
  const [clients, setClients] = useState<IClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado del Formulario
  const [formData, setFormData] = useState({
    id: '',
    businessName: '',
    cuit: '',
    contactName: '',
    contactEmail: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  // 1. Cargar Clientes
  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await callManageHierarchy({ action: 'GET_ALL_CLIENTS', payload: {} });
      const data = (res.data as any).data || [];
      setClients(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la cartera de clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // 2. Manejadores del Modal
  const handleOpenCreate = () => {
    setFormData({ id: '', businessName: '', cuit: '', contactName: '', contactEmail: '', status: 'Active' });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleOpenEdit = (client: IClient) => {
    setFormData({
      id: client.id,
      businessName: String(client.businessName),
      cuit: String(client.cuit),
      contactName: client.contactName || '',
      contactEmail: String(client.contactEmail || ''),
      status: client.status
    });
    setIsEditing(true);
    setShowModal(true);
  };

  // 3. Guardar (Crear o Editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? "Actualizando..." : "Creando empresa...");

    try {
      if (isEditing) {
        // UPDATE
        await callManageHierarchy({ 
            action: 'UPDATE_CLIENT', 
            payload: { 
                id: formData.id, 
                data: {
                    businessName: formData.businessName,
                    cuit: formData.cuit,
                    contactName: formData.contactName,
                    contactEmail: formData.contactEmail,
                    status: formData.status
                }
            } 
        });
        toast.success("Empresa actualizada", { id: toastId });
      } else {
        // CREATE
        await callManageHierarchy({ 
            action: 'CREATE_CLIENT', 
            payload: {
                businessName: formData.businessName,
                cuit: formData.cuit,
                contactName: formData.contactName,
                contactEmail: formData.contactEmail,
                status: formData.status
            }
        });
        toast.success("Empresa creada exitosamente", { id: toastId });
      }
      
      setShowModal(false);
      fetchClients(); // Recargar lista local
      // Opcional: Recargar contexto global si fuera necesario
      // setClient(''); 

    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  // 4. Eliminar
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar a ${name}? Esto podría romper datos históricos.`)) return;
    
    const toastId = toast.loading("Eliminando...");
    try {
        await callManageHierarchy({ action: 'DELETE_CLIENT', payload: { id } });
        toast.success("Empresa eliminada", { id: toastId });
        fetchClients();
    } catch (error: any) {
        toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header de Sección */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Cartera de Clientes</h2>
            <p className="text-sm text-slate-500">Gestione las empresas contratantes.</p>
        </div>
        <Button onClick={handleOpenCreate} primary className="flex items-center shadow-sm">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva Empresa
        </Button>
      </div>

      {/* Tabla Responsiva */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
            <div className="p-12 text-center text-slate-500 animate-pulse">Cargando cartera...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Razón Social</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">CUIT / ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {clients.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">No hay clientes registrados.</td></tr>
                        )}
                        {clients.map((client) => (
                            <tr key={client.id} className="hover:bg-slate-50 transition duration-150">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm mr-3">
                                            {String(client.businessName).charAt(0)}
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">{client.businessName}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                                    {client.cuit}<br/>
                                    <span className="text-[10px] text-slate-400">{client.id.substring(0,8)}...</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-900">{client.contactName}</div>
                                    <div className="text-xs text-slate-500">{client.contactEmail}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        client.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {client.status === 'Active' ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenEdit(client)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">Editar</button>
                                    <button onClick={() => handleDelete(client.id, String(client.businessName))} className="text-rose-600 hover:text-rose-900 font-semibold">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 transform transition-all">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{isEditing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <InputField 
                        label="Razón Social" 
                        id="businessName" 
                        value={formData.businessName} 
                        onChange={e => setFormData({...formData, businessName: e.target.value})} 
                        placeholder="Ej: Seguridad Integral S.A."
                        required 
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <InputField 
                            label="CUIT" 
                            id="cuit" 
                            value={formData.cuit} 
                            onChange={e => setFormData({...formData, cuit: e.target.value})} 
                            placeholder="30-12345678-9"
                            required 
                        />
                        <SelectField 
                            label="Estado" 
                            id="status" 
                            value={formData.status} 
                            onChange={e => setFormData({...formData, status: e.target.value as any})}
                        >
                            <option value="Active">Activo</option>
                            <option value="Inactive">Inactivo</option>
                        </SelectField>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Datos de Contacto</h4>
                        <div className="space-y-4">
                            <InputField 
                                label="Nombre Contacto" 
                                id="contactName" 
                                value={formData.contactName} 
                                onChange={e => setFormData({...formData, contactName: e.target.value})} 
                                placeholder="Ej: Juan Gerente"
                            />
                            <InputField 
                                label="Email Contacto" 
                                id="contactEmail" 
                                type="email"
                                value={formData.contactEmail} 
                                onChange={e => setFormData({...formData, contactEmail: e.target.value})} 
                                placeholder="contacto@empresa.com"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-8 pt-2">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium transition-colors">
                            Cancelar
                        </button>
                        <Button type="submit" primary disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Empresa'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}



