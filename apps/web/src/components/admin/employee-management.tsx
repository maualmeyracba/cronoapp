import React, { useState, useEffect, useRef } from 'react';
import { callManageEmployees, callCreateUser } from '@/services/firebase-client.service';
import { IEmployee, LaborAgreement } from '@/common/interfaces/employee.interface';
import toast from 'react-hot-toast';
import { useClient } from '@/context/ClientContext'; 
import InputField from '@/components/common/InputField';
import SelectField from '@/components/common/SelectField';
import Button from '@/components/common/Button'; 
import { Clock, AlertTriangle, Edit2, Trash2, Briefcase, FileText, Upload, Download, FileSpreadsheet, PieChart } from 'lucide-react';

interface WorkloadReport {
    assignedHours: number;
    completedHours: number;
    maxHours: number;
    cycleStart: string;
    cycleEnd: string;
    details: Array<{ shiftId: string, objectiveName: string, duration: number, status: string, date: string, startTime: string }>;
}

export function EmployeeManagement() {
  const { clients, selectedClientId } = useClient();
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Modales
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false); // 🛑 MODAL NUEVO
  
  // Estados de Edición
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados del Reporte de Auditoría
  const [showWorkloadModal, setShowWorkloadModal] = useState(false);
  const [selectedEmployeeReport, setSelectedEmployeeReport] = useState<IEmployee | null>(null);
  const [workloadReport, setWorkloadReport] = useState<WorkloadReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Estado del Formulario
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    maxHoursPerMonth: 176,
    contractType: 'FullTime',
    laborAgreement: 'SUVICO' as LaborAgreement, // 🛑 NUEVO CAMPO
    isAvailable: true,
    clientId: '', 
    dni: '',
    fileNumber: '',
    address: '',
    payrollCycleStartDay: 1,
    payrollCycleEndDay: 0,
  });

  // --- CARGA DE DATOS ---
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: {} });
      const data = (res.data as any).data || [];
      setEmployees(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la nómina.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const getClientName = (id?: string) => {
      if (!id) return <span className="text-gray-400 italic">Sin Asignación (Pool)</span>;
      const client = clients.find(c => c.id === id);
      return client ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              {client.businessName}
          </span>
      ) : <span className="text-red-400">Cliente desconocido</span>;
  };

  // --- LÓGICA DE IMPORTACIÓN MASIVA (NUEVA) ---
  const handleDownloadTemplate = () => {
      const headers = "nombre,email,dni,legajo,direccion,convenio,modalidad,horas_mensuales,inicio_ciclo\n";
      const example = "Juan Perez,juan@mail.com,12345678,L-100,Av Colon 500,SUVICO,FullTime,176,1";
      const blob = new Blob([headers + example], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_empleados.csv';
      a.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const text = event.target?.result as string;
          const rows = text.split('\n').slice(1); // Ignorar header
          
          const parsedData = rows.map(row => {
              const [name, email, dni, legajo, direccion, convenio, modalidad, horas, ciclo] = row.split(',');
              if (!email || !dni) return null; // Filtrar filas vacías
              return {
                  name: name?.trim(),
                  email: email?.trim(),
                  dni: dni?.trim(),
                  legajo: legajo?.trim(),
                  direccion: direccion?.trim(),
                  convenio: convenio?.trim(),
                  modalidad: modalidad?.trim(),
                  horas_mensuales: horas?.trim(),
                  inicio_ciclo: ciclo?.trim()
              };
          }).filter(Boolean);

          if (parsedData.length === 0) {
              toast.error("El archivo parece estar vacío o tiene formato incorrecto.");
              return;
          }

          if(!confirm(`Se encontraron ${parsedData.length} registros válidos.\n¿Proceder con la importación?\n\nNota: La contraseña inicial será el DNI.`)) return;

          const toastId = toast.loading(`Importando ${parsedData.length} empleados...`);
          try {
              const res = await callManageEmployees({ 
                  action: 'IMPORT_EMPLOYEES', 
                  payload: { rows: parsedData } 
              });
              const result = (res.data as any).data;
              toast.success(`Importación finalizada.\n✅ Éxitos: ${result.success}`, { id: toastId, duration: 5000 });
              
              if(result.errors.length > 0) {
                  console.warn("Errores de importación:", result.errors);
                  toast("Hubo algunos errores, revise la consola.", { icon: '⚠️' });
              }
              
              setShowImportModal(false);
              fetchEmployees();
          } catch (error: any) {
              toast.error("Error crítico en importación: " + error.message, { id: toastId });
          }
          
          // Limpiar input
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  // --- LÓGICA DE REPORTES ---
  const handleOpenWorkloadReport = async (emp: IEmployee) => {
      setSelectedEmployeeReport(emp);
      setShowWorkloadModal(true);
      setReportLoading(true);
      setWorkloadReport(null);

      try {
          const today = new Date();
          const res = await callManageEmployees({
              action: 'GET_WORKLOAD_REPORT',
              payload: { 
                  uid: emp.uid, 
                  month: today.getMonth() + 1, 
                  year: today.getFullYear()
              }
          });
          setWorkloadReport((res.data as any).data as WorkloadReport);
      } catch (e: any) {
          toast.error("Error al cargar reporte: " + e.message);
      } finally {
          setReportLoading(false);
      }
  };

  // --- LÓGICA DE CRUD (FORMULARIO) ---
  const handleOpenCreate = () => {
    setFormData({ 
        uid: '', name: '', email: '', password: '', role: 'employee', 
        maxHoursPerMonth: 176, contractType: 'FullTime', laborAgreement: 'SUVICO', isAvailable: true,
        clientId: selectedClientId || '', 
        dni: '', fileNumber: '', address: '',
        payrollCycleStartDay: 1, 
        payrollCycleEndDay: 0,
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleOpenEdit = (emp: IEmployee) => {
    setFormData({
        uid: emp.uid,
        name: emp.name,
        email: emp.email,
        password: '', 
        role: emp.role as string,
        maxHoursPerMonth: emp.maxHoursPerMonth || 176,
        contractType: emp.contractType || 'FullTime',
        laborAgreement: emp.laborAgreement || 'SUVICO',
        isAvailable: emp.isAvailable,
        clientId: emp.clientId || '',
        dni: emp.dni || '',
        fileNumber: emp.fileNumber || '',
        address: emp.address || '',
        payrollCycleStartDay: emp.payrollCycleStartDay || 1,
        payrollCycleEndDay: emp.payrollCycleEndDay || 0,
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? "Actualizando..." : "Creando recurso...");

    try {
      if (isEditing) {
        const updatePayload = {
            name: formData.name,
            role: formData.role,
            maxHoursPerMonth: Number(formData.maxHoursPerMonth),
            contractType: formData.contractType,
            laborAgreement: formData.laborAgreement,
            isAvailable: formData.isAvailable,
            clientId: formData.clientId,
            dni: formData.dni,
            fileNumber: formData.fileNumber,
            address: formData.address,
            payrollCycleStartDay: Number(formData.payrollCycleStartDay),
            payrollCycleEndDay: Number(formData.payrollCycleEndDay),
        };
        await callManageEmployees({ action: 'UPDATE_EMPLOYEE', payload: { uid: formData.uid, data: updatePayload } });
        toast.success("Ficha actualizada correctamente", { id: toastId });
      } else {
        await callCreateUser({ 
            email: formData.email, password: formData.password, name: formData.name, role: formData.role,
            clientId: formData.clientId, dni: formData.dni, fileNumber: formData.fileNumber, address: formData.address,
        });
        toast.success("Empleado creado exitosamente", { id: toastId });
      }
      
      setShowModal(false);
      fetchEmployees();

    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm("¿Eliminar este empleado? Esta acción borrará su acceso.")) return;
    try {
        await callManageEmployees({ action: 'DELETE_EMPLOYEE', payload: { uid } });
        toast.success("Empleado eliminado");
        fetchEmployees();
    } catch (error) {
        toast.error("Error al eliminar");
    }
  };

  // 🛑 HELPER VISUAL: Agrupa horas por objetivo para el reporte
  const getHoursByObjective = (details: any[]) => {
      const summary: Record<string, number> = {};
      details.forEach(d => {
          const name = d.objectiveName === 'Sede' ? 'Sede (Genérico)' : d.objectiveName;
          summary[name] = (summary[name] || 0) + d.duration;
      });
      return Object.entries(summary).map(([name, hours]) => ({ name, hours }));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER CON BOTONES DE ACCIÓN */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
            <h2 className="text-xl font-bold text-gray-800">Nómina Global de Personal</h2>
            <p className="text-sm text-gray-500">Gestión del pool de recursos de la agencia.</p>
        </div>
        <div className="flex gap-3">
            {/* 🛑 BOTÓN DE IMPORTACIÓN (NUEVO) */}
            <Button 
                onClick={() => setShowImportModal(true)} 
                className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-2 shadow-sm"
            >
                <Upload size={18} className="text-green-600"/> Importar CSV
            </Button>
            
            {/* Botón Nuevo Recurso */}
            <Button onClick={handleOpenCreate} primary className="flex items-center gap-2 shadow-sm">
                <span className="text-lg font-bold">+</span> Nuevo Recurso
            </Button>
        </div>
      </div>

      {/* 2. TABLA DE EMPLEADOS */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Legajo / Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Asignación</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Convenio</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((emp) => (
                        <tr key={emp.uid} className="hover:bg-gray-50 transition-colors">
                            <td 
                                onClick={() => handleOpenWorkloadReport(emp)}
                                className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-indigo-50/50"
                                title="Ver auditoría de horas"
                            >
                                <div className="text-xs text-gray-400 font-mono mb-0.5">#{emp.fileNumber || 'S/N'}</div>
                                <div className="text-sm font-bold text-gray-900">{emp.name}</div>
                                <div className="text-xs text-indigo-600 capitalize">{emp.role}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getClientName(emp.clientId)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    emp.laborAgreement === 'SUVICO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    emp.laborAgreement === 'UOCRA' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    <FileText size={10} className="mr-1.5"/>
                                    {emp.laborAgreement || 'SUVICO'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {emp.isAvailable ? 
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Activo</span> : 
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Inactivo</span>
                                }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end items-center gap-2">
                                <button onClick={() => handleOpenWorkloadReport(emp)} className="text-blue-600 hover:text-blue-900 mr-2 font-semibold flex items-center bg-blue-50 px-2 py-1.5 rounded hover:bg-blue-100 transition-colors" title="Ver Horas">
                                    <Clock size={14} className="mr-1"/> Horas
                                </button>
                                <button onClick={() => handleOpenEdit(emp)} className="text-gray-500 hover:text-indigo-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Editar">
                                    <Edit2 size={18}/>
                                </button>
                                <button onClick={() => handleDelete(emp.uid)} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Eliminar">
                                    <Trash2 size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!loading && employees.length === 0 && (
                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                    <Briefcase size={48} className="text-gray-300 mb-3"/>
                    <p>No hay empleados registrados en el sistema.</p>
                    <p className="text-sm mt-2">Utilice el botón "Nuevo" o "Importar CSV".</p>
                </div>
            )}
        </div>
      </div>

      {/* 3. MODAL DE IMPORTACIÓN (NUEVO) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-100 transform scale-100 transition-all">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileSpreadsheet className="text-green-600"/> Importación Masiva
                    </h3>
                    <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <p className="font-bold mb-2 flex items-center gap-2"><Briefcase size={16}/> Instrucciones:</p>
                        <ul className="list-disc list-inside space-y-1 ml-1 text-blue-700">
                            <li>Descargue la plantilla CSV modelo.</li>
                            <li>Complete los datos respetando las columnas.</li>
                            <li>La <strong>contraseña inicial</strong> será el DNI del empleado.</li>
                        </ul>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            onClick={handleDownloadTemplate} 
                            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-gray-600 font-medium"
                        >
                            <Download size={20}/> Descargar Plantilla
                        </button>
                        
                        <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold cursor-pointer shadow-md active:scale-95">
                            <Upload size={20}/> Subir Archivo
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 4. MODAL DE FORMULARIO (CREAR/EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-100 transform transition-all">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Ficha' : 'Alta de Personal'}</h3>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Información Personal</h4>
                    </div>

                    <InputField label="Nombre Completo" id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <InputField label="DNI" id="dni" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} required placeholder="Sin puntos" />
                    <div className="md:col-span-2">
                        <InputField label="Dirección Real" id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
                    </div>

                    {!isEditing && (
                        <>
                            <div className="md:col-span-2 mt-2">
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Acceso al Sistema</h4>
                            </div>
                            <InputField label="Email" id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                            <InputField label="Contraseña Inicial" id="password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        </>
                    )}

                    <div className="md:col-span-2 mt-2">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Contratación y Asignación</h4>
                    </div>

                    <InputField label="Nro. Legajo" id="fileNumber" value={formData.fileNumber} onChange={e => setFormData({...formData, fileNumber: e.target.value})} required />

                    <SelectField label="Empresa Principal (Opcional)" id="clientId" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                        <option value="">-- Sin Asignación (Pool) --</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
                    </SelectField>

                    <SelectField label="Convenio Colectivo" id="laborAgreement" value={formData.laborAgreement} onChange={e => setFormData({...formData, laborAgreement: e.target.value as any})}>
                        <option value="SUVICO">Seguridad (SUVICO)</option>
                        <option value="COMERCIO">Administrativos (Comercio)</option>
                        <option value="UOCRA">Construcción (UOCRA)</option>
                        <option value="FUERA_CONVENIO">Fuera de Convenio</option>
                    </SelectField>

                    <SelectField label="Modalidad" id="contract" value={formData.contractType} onChange={e => setFormData({...formData, contractType: e.target.value})}>
                        <option value="FullTime">Full Time</option>
                        <option value="PartTime">Part Time</option>
                        <option value="Eventual">Eventual</option>
                    </SelectField>

                    <InputField label="Límite Horas Mensual" id="maxHours" type="number" value={formData.maxHoursPerMonth} onChange={e => setFormData({...formData, maxHoursPerMonth: Number(e.target.value)})} required />

                    <div className="md:col-span-2 border p-3 rounded-lg bg-yellow-50/50 border-yellow-200">
                        <h5 className="text-xs font-bold text-yellow-800 mb-2">Ciclo de Nómina</h5>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectField label="Día Inicio de Ciclo" id="cycleStart" value={formData.payrollCycleStartDay} onChange={e => setFormData({...formData, payrollCycleStartDay: Number(e.target.value)})}>
                                <option value={1}>Día 1 (Calendario Estándar)</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => <option key={day} value={day}>Día {day}</option>)}
                            </SelectField>
                            <SelectField label="Día Fin de Ciclo" id="cycleEnd" value={formData.payrollCycleEndDay} onChange={e => setFormData({...formData, payrollCycleEndDay: Number(e.target.value)})}>
                                <option value={0}>Último Día del Mes (Estándar)</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => <option key={day} value={day}>Día {day}</option>)}
                            </SelectField>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 flex justify-end space-x-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition">
                            Cancelar
                        </button>
                        <Button type="submit" primary disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Ficha'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* 5. MODAL DE REPORTE (AUDITORÍA DE HORAS) */}
      {showWorkloadModal && selectedEmployeeReport && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-gray-100 transform transition-all scale-100">
                  <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                      <h3 className="text-xl font-bold text-gray-800">Ficha de Recurso y Auditoría de Horas</h3>
                      <button onClick={() => setShowWorkloadModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                  </div>
                  
                  <h4 className="text-lg font-bold text-indigo-700 mb-4">{selectedEmployeeReport.name} ({selectedEmployeeReport.dni})</h4>

                  {reportLoading ? (
                      <div className="p-10 text-center text-gray-500 animate-pulse">Calculando reporte del mes...</div>
                  ) : workloadReport ? (
                      <div className="space-y-6">
                          
                          {/* Info General */}
                          <div className='grid grid-cols-2 gap-4 text-sm'>
                              <div className='p-3 bg-gray-50 rounded'>
                                  <p className='text-xs text-gray-500 font-bold uppercase'>Legajo / Email</p>
                                  <p>{selectedEmployeeReport.fileNumber || 'S/N'} / {selectedEmployeeReport.email}</p>
                              </div>
                              <div className='p-3 bg-gray-50 rounded'>
                                  <p className='text-xs text-gray-500 font-bold uppercase'>Dirección</p>
                                  <p>{selectedEmployeeReport.address || 'N/A'}</p>
                              </div>
                          </div>

                          {/* Periodo y Ciclo */}
                          <div className='p-3 bg-indigo-50 rounded-xl border border-indigo-100'>
                             <p className='text-xs font-bold text-indigo-600 uppercase'>Período de Cálculo</p>
                             <p className='text-sm mt-1'>
                                 {workloadReport.cycleStart} al {workloadReport.cycleEnd}
                                 <span className='text-xs text-gray-500 ml-2'>(Definido por Ciclo de Nómina)</span>
                             </p>
                          </div>
                          
                          {/* KPIs Principales */}
                          <div className="grid grid-cols-3 gap-4">
                              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                  <p className="text-xs font-bold text-indigo-600 uppercase">Límite Contratado</p>
                                  <p className="text-2xl font-bold mt-1">{workloadReport.maxHours} hs</p>
                              </div>
                              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                  <p className="text-xs font-bold text-yellow-600 uppercase">Horas Asignadas</p>
                                  <p className="text-2xl font-bold mt-1">{workloadReport.assignedHours} hs</p>
                                  {workloadReport.assignedHours > workloadReport.maxHours ? (
                                      <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center"><AlertTriangle size={12}/> ¡EXCESO DETECTADO!</p>
                                  ) : (
                                      <p className="text-[10px] text-green-600 font-bold mt-1">Dentro de límite</p>
                                  )}
                              </div>
                              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                  <p className="text-xs font-bold text-green-600 uppercase">Horas Trabajadas (Completed)</p>
                                  <p className="text-2xl font-bold mt-1">{workloadReport.completedHours} hs</p>
                              </div>
                          </div>

                          {/* 🛑 NUEVO GRÁFICO: RESUMEN POR OBJETIVO */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><PieChart size={14}/> Distribución por Objetivo</h5>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {getHoursByObjective(workloadReport.details).map((item, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center">
                                          <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]" title={item.name}>{item.name}</span>
                                          <span className="text-sm font-mono font-bold text-indigo-600">{item.hours}h</span>
                                      </div>
                                  ))}
                                  {workloadReport.details.length === 0 && <span className="text-xs text-gray-400 italic col-span-3">Sin actividad registrada.</span>}
                              </div>
                          </div>

                          {/* Detalle Diario */}
                          <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Detalle Diario de Asignaciones</h5>
                              <div className="h-48 overflow-y-auto border border-gray-200 rounded-lg">
                                  <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50 sticky top-0">
                                          <tr>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Duración</th>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Objetivo</th>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                                          </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                          {workloadReport.details.map((d, index) => (
                                              <tr key={index} className={d.status === 'Completed' ? 'text-gray-600 bg-gray-50' : 'font-medium hover:bg-slate-50'}>
                                                  <td className="px-4 py-2 whitespace-nowrap text-xs">{d.date} ({d.startTime})</td>
                                                  <td className="px-4 py-2 whitespace-nowrap text-xs">{d.duration} hs</td>
                                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-bold text-slate-700">{d.objectiveName}</td>
                                                  <td className="px-4 py-2 whitespace-nowrap">
                                                      <span className={`px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full ${d.status === 'Assigned' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                          {d.status}
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                  ) : null}
                  
                  <div className="mt-6 flex justify-end">
                      <button onClick={() => setShowWorkloadModal(false)} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium transition-colors">
                          Cerrar Ficha
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}



