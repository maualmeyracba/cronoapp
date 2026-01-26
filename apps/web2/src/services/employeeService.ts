import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

export interface Employee {
  id?: string;
  firstName: string;
  lastName: string;
  dni: string;
  cuil?: string;           // NUEVO: Agregado campo CUIL
  fileNumber: string;
  phone: string;
  email: string;
  category: string;
  status: string;
  startDate?: string;      // NUEVO: Agregado fecha de ingreso (string en tu DB)
  cycleStartDay?: number;  // NUEVO: Agregado inicio de ciclo (number en tu DB)
  laborAgreement?: string;
  preferredClientId?: string;
  preferredObjectiveId?: string;
}

export const employeeService = {
  getAll: async () => {
    try {
      console.log("🔍 [Service] Buscando empleados...");
      
      // Estrategia de Fallback en Cascada
      let snapshot = await getDocs(collection(db, 'empleados'));
      if (snapshot.empty) snapshot = await getDocs(collection(db, 'employees'));
      if (snapshot.empty) snapshot = await getDocs(collection(db, 'users')); // Último recurso

      console.log(`✅ [Service] Encontrados ${snapshot.size} documentos.`);

      return snapshot.docs.map(d => {
          const data = d.data();
          
          // Lógica de Nombres: Intentar separar, si no, usar completo
          let fName = data.firstName || data.nombre || '';
          let lName = data.lastName || data.apellido || '';
          
          // Si no hay nombre/apellido por separado pero hay 'name'
          if (!fName && !lName && data.name) {
              const parts = data.name.split(' ');
              fName = parts[0];
              lName = parts.slice(1).join(' ') || '';
          }

          return { 
              id: d.id, 
              firstName: fName || 'Sin Nombre',
              lastName: lName || '',
              dni: data.dni || data.document || 'S/D', // Limpié para que cuil vaya en su propio campo
              
              // --- NUEVOS CAMPOS ---
              cuil: data.cuil || '', // Ahora leemos explícitamente el CUIL
              startDate: data.startDate || data.fechaIngreso || '', // Leemos la fecha de ingreso
              cycleStartDay: data.cycleStartDay || 1, // Leemos inicio de ciclo (default a 1 si no existe)
              // ---------------------

              fileNumber: data.fileNumber || data.legajo || 'S/N',
              phone: data.phone || data.telefono || '',
              email: data.email || '',
              category: data.category || data.cargo || 'Vigilador',
              status: data.status || data.estado || 'active',
              laborAgreement: data.laborAgreement || data.convenio || 'SUVICO',
              preferredClientId: data.preferredClientId || '',
              preferredObjectiveId: data.preferredObjectiveId || ''
          } as Employee;
      });
    } catch (e) {
      console.error("❌ Error cargando empleados:", e);
      return [];
    }
  },

  add: async (data: Employee) => addDoc(collection(db, 'empleados'), data),
  update: (id: string, data: Partial<Employee>) => updateDoc(doc(db, 'empleados', id), data),
  delete: (id: string) => deleteDoc(doc(db, 'empleados', id)),
};