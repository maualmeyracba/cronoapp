import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

// ==================================================================
// 🛑 INTERFACES INTERNAS (ESTRATEGIA ANTI-CRASH)
// Al definirlas aquí, eliminamos el error de "Module not found" en Runtime.
// ==================================================================

export interface IClient {
  id: string;
  businessName: string;
  cuit: string;
  contactName: string;
  contactEmail: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: admin.firestore.Timestamp;
}

export interface IObjective {
  id: string;
  clientId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  zones?: string[];
}

export interface IServiceContract {
  id: string;
  objectiveId: string;
  name: string;
  startDate: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  totalHoursPerMonth: number;
  isActive: boolean;
}

export interface IShiftType {
  id: string;
  contractId: string;
  name: string;
  code: string;
  color: string;
  startTime: string;
  durationHours: number;
  requiredRole?: string;
}

// ==================================================================
// SERVICIO PRINCIPAL
// ==================================================================

@Injectable()
export class ClientService {
  // Inicialización segura de Firestore
  private getDb = () => admin.app().firestore();
  
  // Nombres de colecciones constantes
  private readonly clientsCollection = 'clientes';
  private readonly objectivesCollection = 'objetivos';
  private readonly contractsCollection = 'contratos';
  private readonly shiftTypesCollection = 'modalidades';

  // --- 1. GESTIÓN DE CLIENTES (EMPRESAS) ---

  async createClient(data: any): Promise<IClient> {
    const db = this.getDb();
    const ref = db.collection(this.clientsCollection).doc();
    
    const client: IClient = {
      id: ref.id,
      businessName: data.businessName,
      cuit: data.cuit,
      contactName: data.contactName || '',
      contactEmail: data.contactEmail || '',
      status: 'Active',
      createdAt: admin.firestore.Timestamp.now(),
    };
    
    await ref.set(client);
    return client;
  }

  async getClient(id: string): Promise<IClient | null> {
    const db = this.getDb();
    const doc = await db.collection(this.clientsCollection).doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as IClient) : null;
  }

  async findAllClients(): Promise<IClient[]> {
    const db = this.getDb();
    const snapshot = await db.collection(this.clientsCollection).get();
    
    // Mapeo seguro para evitar errores si faltan campos en la DB antigua
    return snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
            id: doc.id, 
            ...d 
        } as IClient;
    });
  }

  async updateClient(id: string, data: Partial<IClient>): Promise<void> {
    const db = this.getDb();
    await db.collection(this.clientsCollection).doc(id).update(data);
  }

  async deleteClient(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.clientsCollection).doc(id).delete();
  }

  // --- 2. GESTIÓN DE OBJETIVOS ---

  async createObjective(data: any): Promise<IObjective> {
    const db = this.getDb();
    const ref = db.collection(this.objectivesCollection).doc();
    
    const objective: IObjective = {
      id: ref.id,
      clientId: data.clientId,
      name: data.name,
      address: data.address,
      location: data.location || { latitude: 0, longitude: 0 },
      zones: data.zones || []
    };
    
    await ref.set(objective);
    return objective;
  }

  async findAllObjectives(clientId?: string): Promise<IObjective[]> {
      const db = this.getDb();
      let query: admin.firestore.Query = db.collection(this.objectivesCollection);

      if (clientId) {
          query = query.where('clientId', '==', clientId);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IObjective));
  }

  // --- 3. CONTRATOS Y MODALIDADES (Stubs para evitar errores si se llaman) ---

  async createServiceContract(data: any): Promise<IServiceContract> {
      const db = this.getDb();
      const ref = db.collection(this.contractsCollection).doc();
      // Lógica básica de guardado
      const contract: IServiceContract = {
          id: ref.id,
          ...data,
          startDate: admin.firestore.Timestamp.now(), 
          isActive: true
      };
      await ref.set(contract);
      return contract;
  }

  async createShiftType(data: any): Promise<IShiftType> {
      const db = this.getDb();
      const ref = db.collection(this.shiftTypesCollection).doc();
      const type: IShiftType = { id: ref.id, ...data };
      await ref.set(type);
      return type;
  }

  async getShiftTypesByContract(contractId: string): Promise<IShiftType[]> {
      const db = this.getDb();
      const snapshot = await db.collection(this.shiftTypesCollection).where('contractId', '==', contractId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IShiftType));
  }
}