
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';

export interface Absence {
  id?: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'Pendiente' | 'Justificada' | 'Injustificada';
  hasCertificate: boolean;
  reason: string;
  comments: string;
}

export const absenceService = {
  getAll: async () => {
    const q = query(collection(db, 'ausencias'), orderBy('startDate', 'desc'));
    const s = await getDocs(q);
    return s.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            // DEFAULTS DE SEGURIDAD PARA EVITAR CRASH
            employeeName: data.employeeName || '', // Evita undefined
            status: data.status || 'Pendiente',
            hasCertificate: data.hasCertificate || false,
            reason: data.reason || '',
            comments: data.comments || ''
        } as Absence;
    });
  },

  add: async (data: Absence) => addDoc(collection(db, 'ausencias'), {
      ...data,
      createdAt: new Date().toISOString()
  }),

  update: async (id: string, data: Partial<Absence>) => updateDoc(doc(db, 'ausencias', id), data),
  
  delete: (id: string) => deleteDoc(doc(db, 'ausencias', id))
};
