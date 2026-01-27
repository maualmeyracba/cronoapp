import { useQuery } from '@tanstack/react-query';
import { callManageAudits } from '@/services/firebase-client.service';
import { useClient } from '@/context/ClientContext';

export function useAuditLogs(filters: any) {
  const { selectedClientId } = useClient();

  return useQuery({
    // Incluimos el ID del cliente en la queryKey para que refresque al cambiar de empresa
    queryKey: ['audit-logs', selectedClientId, filters],
    queryFn: async () => {
      console.log("🛰️ Enviando petición de Auditoría para Cliente:", selectedClientId);
      
      try {
        const res: any = await callManageAudits({ 
          action: 'GET_LOGS', 
          payload: { 
            ...filters,
            clientId: selectedClientId // IMPORTANTE: Enviamos el ID al backend
          } 
        });
        
        console.log("📥 Respuesta recibida:", res);

        // Extraemos los datos intentando todas las rutas posibles del objeto
        const finalData = res?.data?.data || res?.data || res || [];
        return Array.isArray(finalData) ? finalData : [];
      } catch (err) {
        console.error("❌ Error crítico en Auditoría:", err);
        return [];
      }
    },
    // Solo se ejecuta si hay un cliente seleccionado
    enabled: !!selectedClientId,
  });
}