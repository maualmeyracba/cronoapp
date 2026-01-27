import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { callManageEmployees, callManageData } from '@/services/firebase-client.service';
import { IEmployee } from '@/common/interfaces/employee.interface';
import { IObjective } from '@/common/interfaces/client.interface';

export const useSchedulerDataFetcher = (selectedClientId: string | null) => {
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [objectives, setObjectives] = useState<IObjective[]>([]);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchAll = async () => {
            // 🛑 DEBUG: Verificar qué ID llega al hook
            console.log("🔄 [Fetcher] Cambio de empresa detectado. ID:", selectedClientId);

            // Si no hay cliente seleccionado, limpiamos y salimos
            if (!selectedClientId) {
                console.log("⚠️ [Fetcher] No hay cliente seleccionado. Limpiando datos.");
                setEmployees([]);
                setObjectives([]);
                setSelectedObjectiveId('');
                return;
            }

            setIsLoading(true);
            
            try {
                // 1. Obtener Empleados (Con filtro de empresa)
                console.log("📡 [Fetcher] Solicitando empleados al Backend para cliente:", selectedClientId);
                
                const empRes = await callManageEmployees({ 
                    action: 'GET_ALL_EMPLOYEES', 
                    payload: { clientId: selectedClientId } // 🛑 Aquí enviamos el filtro
                });
                
                // Manejo defensivo de la respuesta
                const empData = (empRes.data as any).data || [];
                
                // 🛑 DEBUG: Verificar qué devolvió el Backend
                console.log(`✅ [Fetcher] Recibidos ${empData.length} empleados.`);
                console.log("📋 [Fetcher] Lista de empleados:", empData);
                
                setEmployees(empData);

                // 2. Obtener Objetivos (Con filtro de empresa)
                console.log("📡 [Fetcher] Solicitando objetivos...");
                const objRes = await callManageData({ 
                    action: 'GET_ALL_OBJECTIVES', 
                    payload: { clientId: selectedClientId } 
                });
                
                const objData = (objRes.data as any).data || [];
                setObjectives(objData);
                
                // Seleccionar automáticamente el primer objetivo si existe
                if (objData.length > 0) {
                    setSelectedObjectiveId(objData[0].id);
                } else {
                    setSelectedObjectiveId('');
                }
            
            } catch (error) {
                console.error("❌ [Fetcher] Error CRÍTICO cargando datos:", error);
                toast.error("Error al cargar los datos de la empresa.");
                setEmployees([]);
                setObjectives([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();

    }, [selectedClientId]); // 🛑 DEPENDENCIA: Se ejecuta al cambiar el cliente

    return { 
        employees, 
        objectives, 
        selectedObjectiveId, 
        setSelectedObjectiveId, 
        isLoading 
    };
};



