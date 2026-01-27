import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useClient } from '@/context/ClientContext';
import { IAbsencePayload, IEmployee } from '@/common/interfaces/employee.interface';
import { createAbsence, callManageEmployees } from '@/services/firebase-client.service';
import InputField from '@/components/common/InputField'; 
import SelectField from '@/components/common/SelectField';
import Button from '@/components/common/Button';

const ABSENCE_TYPES = [
    { value: 'VACATION', label: 'Vacaciones' },
    { value: 'SICK_LEAVE', label: 'Licencia Médica' },
    { value: 'OTHER', label: 'Otro / Personal' },
];

export function AbsenceManagementPage() {
    const { selectedClientId, selectedClient } = useClient();
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Estado inicial del formulario
    const [formData, setFormData] = useState<IAbsencePayload>({
        employeeId: '',
        employeeName: '',
        clientId: selectedClientId || '',
        type: 'VACATION',
        startDate: new Date(),
        endDate: new Date(),
        reason: '',
    });

    // Sincronizar clientId cuando cambia la selección en el menú
    useEffect(() => {
        setFormData(prev => ({ 
            ...prev, 
            clientId: selectedClientId || '', 
            employeeId: '', 
            employeeName: '' 
        }));
    }, [selectedClientId]);

    // Cargar Empleados (Filtrados por Empresa)
    useEffect(() => {
        const fetchEmployees = async () => {
            if (!selectedClientId) {
                setEmployees([]);
                return;
            }

            setIsLoadingEmployees(true);
            try {
                const empRes = await callManageEmployees({ 
                    action: 'GET_ALL_EMPLOYEES', 
                    payload: { clientId: selectedClientId } 
                });
                
                setEmployees((empRes.data as any).data || []); 
            } catch (error) {
                console.error("Error fetching employees:", error);
                toast.error("No se pudo cargar la lista de empleados.");
            } finally {
                setIsLoadingEmployees(false);
            }
        };
        fetchEmployees();
    }, [selectedClientId]);

    const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedEmployee = employees.find(emp => emp.uid === selectedId);

        setFormData(prev => ({
            ...prev,
            employeeId: selectedId,
            employeeName: selectedEmployee ? selectedEmployee.name : ''
        }));
    };

    const handleDateChange = (name: keyof IAbsencePayload, value: string) => {
        // 🛑 FIX CRÍTICO DE FECHAS:
        // Al crear la fecha desde el string YYYY-MM-DD del input, agregamos T12:00:00.
        // Esto evita que, por diferencias de zona horaria (UTC-3), la fecha "retroceda" un día
        // al guardarse. El backend luego forzará 00:00 y 23:59.
        const dateValue = new Date(value + 'T12:00:00'); 
        
        setFormData(prev => ({
            ...prev,
            [name]: dateValue,
        }));
    };

    const validateForm = (data: IAbsencePayload): boolean => {
        if (!data.employeeId || !data.clientId || !data.type) {
            toast.error("Complete los campos obligatorios (Empleado, Tipo).");
            return false;
        }
        if (data.startDate.getTime() > data.endDate.getTime()) {
            toast.error("La fecha de inicio no puede ser posterior a la de fin.");
            return false;
        }
        if (!data.reason.trim()) {
            toast.error("Debe proporcionar una razón o comentario.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm(formData)) return;

        setIsSubmitting(true);
        const toastId = toast.loading(`Registrando ${formData.type}...`);

        try {
            // Enviamos al servicio (que llama a la Cloud Function)
            // El backend se encarga de verificar conflictos y generar vacantes si es necesario
            const res = await createAbsence({ action: 'CREATE_ABSENCE', payload: formData });
            
            // Feedback Inteligente: Avisamos si hubo impacto operativo
            if (res.impactedShiftsCount && res.impactedShiftsCount > 0) {
                toast.success(
                    `Novedad registrada.\n⚠️ Se liberaron ${res.impactedShiftsCount} turnos que ahora son VACANTES.`,
                    { id: toastId, duration: 6000, icon: '⚠️' }
                );
            } else {
                toast.success("Novedad registrada exitosamente.", { id: toastId });
            }
            
            // Reset del formulario (mantenemos fechas hoy para agilidad)
            setFormData(prev => ({ 
                ...prev, 
                type: 'VACATION', 
                startDate: new Date(), 
                endDate: new Date(), 
                reason: '' 
            }));

        } catch (error: any) {
            console.error("Absence creation failed:", error);
            const message = error.message.includes('Conflicto') || error.message.includes('BLOQUEO')
                ? error.message 
                : "Error al registrar la novedad. Intente nuevamente.";
            toast.error(message, { id: toastId, duration: 5000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!selectedClientId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="bg-orange-100 p-3 rounded-full mb-4">
                    <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Selección Requerida</h3>
                <p className="text-gray-500 mt-2">Por favor, seleccione una empresa en el menú lateral para gestionar las novedades de su personal.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestión de Novedades</h2>
                    <p className="text-slate-500">Registrar licencias y vacaciones para <span className="font-semibold text-indigo-600">{selectedClient?.businessName}</span>.</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    <SelectField
                        label="Colaborador"
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={handleEmployeeChange}
                        disabled={isLoadingEmployees || isSubmitting}
                        required
                    >
                        <option value="" disabled>{isLoadingEmployees ? 'Cargando...' : 'Seleccione un colaborador'}</option>
                        {employees.map(emp => (
                            <option key={emp.uid} value={emp.uid}>
                                {emp.name} (Leg: {emp.fileNumber || 'S/N'})
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Tipo de Novedad"
                        id="type"
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as IAbsencePayload['type'] }))}
                        disabled={isSubmitting}
                        required
                    >
                        {ABSENCE_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </SelectField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                            label="Fecha de Inicio"
                            id="startDate"
                            type="date"
                            // .slice(0, 10) asegura formato YYYY-MM-DD
                            value={formData.startDate.toISOString().slice(0, 10)}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                        <InputField
                            label="Fecha de Fin"
                            id="endDate"
                            type="date"
                            value={formData.endDate.toISOString().slice(0, 10)}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    <InputField
                        label="Razón / Comentarios"
                        id="reason"
                        type="textarea"
                        value={formData.reason}
                        onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                        rows={3}
                        disabled={isSubmitting}
                        required
                        placeholder="Detalle el motivo de la ausencia..."
                    />
                    
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <Button type="submit" disabled={isSubmitting || !formData.employeeId} primary className="w-full md:w-auto">
                            {isSubmitting ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Validando y Registrando...
                                </span>
                            ) : 'Registrar Novedad'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}



