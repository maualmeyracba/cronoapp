import React, { useState, useEffect } from 'react';
import { callManageSystemUsers } from '@/services/firebase-client.service';
import { ISystemUser } from '@/common/interfaces/system-user.interface';
import toast from 'react-hot-toast';

export function SystemUserManagement() {
  const [users, setUsers] = useState<ISystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    uid: '',
    displayName: '',
    email: '',
    password: '',
    role: 'Scheduler',
    status: 'Active'
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await callManageSystemUsers({ action: 'GET_ALL_USERS', payload: {} });
      const data = (res.data as any).data || [];
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setFormData({ uid: '', displayName: '', email: '', password: '', role: 'Scheduler', status: 'Active' });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Procesando...");

    try {
      if (isEditing) {
        // Solo enviamos lo que cambia
        const payload = {
            uid: formData.uid,
            data: {
                role: formData.role,
                status: formData.status,
                displayName: formData.displayName
            }
        };
        await callManageSystemUsers({ action: 'UPDATE_USER', payload });
        toast.success("Usuario actualizado", { id: toastId });
      } else {
        await callManageSystemUsers({ 
            action: 'CREATE_USER', 
            payload: {
                email: formData.email,
                password: formData.password,
                displayName: formData.displayName,
                role: formData.role
            }
        });
        toast.success("Administrador creado", { id: toastId });
      }
      setShowModal(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm("¿Eliminar este administrador? Perderá el acceso inmediatamente.")) return;
    try {
        await callManageSystemUsers({ action: 'DELETE_USER', payload: { uid } });
        toast.success("Usuario eliminado");
        fetchUsers();
    } catch (error) {
        toast.error("Error al eliminar");
    }
  };

  // Estilos
  const inputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-gray-800">Usuarios del Sistema</h2>
            <p className="text-sm text-gray-500">Gestione el acceso al panel administrativo.</p>
        </div>
        <button onClick={handleOpenCreate} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition shadow-sm flex items-center">
            <span className="mr-2">+</span> Nuevo Admin
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Acciones</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs">
                                    {user.displayName.charAt(0)}
                                </div>
                                <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {user.role}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {user.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => handleDelete(user.uid)} className="text-red-600 hover:text-red-900">Eliminar</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{isEditing ? 'Editar Usuario' : 'Nuevo Administrador'}</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div><label className={labelClass}>Nombre</label><input className={inputClass} value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} required /></div>
                    {!isEditing && (
                        <>
                            <div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
                            <div><label className={labelClass}>Contraseña</label><input type="password" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div>
                        </>
                    )}
                    <div>
                        <label className={labelClass}>Rol de Sistema</label>
                        <select className={inputClass} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                            <option value="SuperAdmin">Super Admin (Total)</option>
                            <option value="Scheduler">Planificador (Turnos)</option>
                            <option value="HR_Manager">RRHH (Empleados)</option>
                            <option value="Viewer">Solo Lectura</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-white bg-gray-900 rounded-lg hover:bg-black">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}



