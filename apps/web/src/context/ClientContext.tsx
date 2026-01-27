import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, callManageHierarchy } from '@/services/firebase-client.service';
import { IClient } from '@/common/interfaces/client.interface';
import toast from 'react-hot-toast';

interface ClientContextType {
  clients: IClient[];
  selectedClientId: string;
  selectedClient: IClient | undefined;
  setClient: (id: string) => void;
  loading: boolean;
}

// Roles que tienen permiso para ver empresas
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager', 'Manager', 'Operator', 'Supervisor'];

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<IClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(''); // Default: Vacío = "Todos"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          const role = tokenResult.claims.role as string;

          if (ADMIN_ROLES.includes(role)) {
            await loadClients();
          } else {
            setLoading(false);
          }
        } catch (error) {
          console.error("Error verificando permisos:", error);
          setLoading(false);
        }
      } else {
        setClients([]);
        setSelectedClientId('');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadClients() {
    try {
      const res = await callManageHierarchy({ action: 'GET_ALL_CLIENTS', payload: {} });
      const responseData = res.data as any; 
      const data = responseData.data || [];
      
      setClients(data);

      // 🛑 LÓGICA DE SELECCIÓN INTELIGENTE
      const savedId = localStorage.getItem('selectedClientId');
      
      // Si hay un guardado válido, lo usamos.
      if (savedId && (savedId === '' || data.find((c: IClient) => c.id === savedId))) {
        setSelectedClientId(savedId);
      } else {
        // Si no hay nada guardado, por defecto mostramos "TODOS" (vacío)
        // Esto es mejor para una visión gerencial.
        setSelectedClientId('');
      }

    } catch (error: any) {
      console.error("Error loading clients", error);
      toast.error("No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  }

  const setClient = (id: string) => {
    setSelectedClientId(id);
    localStorage.setItem('selectedClientId', id);
    
    // Feedback visual opcional
    if (id === '') toast.success("Vista Global activada");
    else {
        const clientName = clients.find(c => c.id === id)?.businessName;
        toast.success(`Filtrando por: ${clientName}`);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <ClientContext.Provider value={{ clients, selectedClientId, selectedClient, setClient, loading }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClient debe usarse dentro de ClientProvider');
  return context;
}



