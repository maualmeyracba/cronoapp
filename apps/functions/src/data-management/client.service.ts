import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
// Rutas relativas correctas para evitar errores de compilación TS2307
import { 
  IClient, 
  IObjective, 
  IServiceContract, 
  IShiftType 
} from '../common/interfaces/client.interface'; 

const COLL_CLIENTS = 'clientes';
const COLL_OBJECTIVES = 'objetivos';
const COLL_CONTRACTS = 'contratos_servicio';
const COLL_SHIFT_TYPES = 'tipos_turno';

@Injectable()
export class ClientService {

  // 🔑 Inicialización diferida (Lazy Loading) para evitar error 'app/no-app'
  private getDb = () => admin.app().firestore();

  // ==========================================
  // 1. GESTIÓN DE CLIENTES (EMPRESAS)
  // ==========================================

  async createClient(data: Omit<IClient, 'id' | 'createdAt'>): Promise<IClient> {
    const db = this.getDb();
    const ref = db.collection(COLL_CLIENTS).doc();
    
    const newClient: IClient = {
      ...data,
      id: ref.id,
      createdAt: admin.firestore.Timestamp.now(),
    };

    await ref.set(newClient);
    return newClient;
  }

  async getClient(id: string): Promise<IClient> {
    const doc = await this.getDb().collection(COLL_CLIENTS).doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cliente no encontrado');
    return { id: doc.id, ...doc.data() } as IClient;
  }

  async findAllClients(): Promise<IClient[]> {
    try {
      // Nota: Si quieres ver incluso los eliminados/inactivos, quita el .where
      const snapshot = await this.getDb().collection(COLL_CLIENTS)
        // .where('status', '==', 'Active') // Descomentar para filtrar solo activos
        .get();

      if (snapshot.empty) return [];

      return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      } as IClient));

    } catch (error) {
      console.error('[ERROR_FIND_CLIENTS]', error);
      throw new InternalServerErrorException('Error al consultar clientes.');
    }
  }

  // 🛑 NUEVO: Actualizar Cliente
  async updateClient(id: string, data: Partial<IClient>): Promise<void> {
    const ref = this.getDb().collection(COLL_CLIENTS).doc(id);
    
    // Protección: No permitir modificar ID ni fecha de creación
    const updateData = { ...data };
    delete (updateData as any).id;
    delete (updateData as any).createdAt;

    await ref.update(updateData);
  }

  // 🛑 NUEVO: Eliminar Cliente
  async deleteClient(id: string): Promise<void> {
    await this.getDb().collection(COLL_CLIENTS).doc(id).delete();
  }

  // ==========================================
  // 2. GESTIÓN DE OBJETIVOS (SEDES)
  // ==========================================

  async createObjective(data: Omit<IObjective, 'id'>): Promise<IObjective> {
    await this.getClient(data.clientId); // Validar existencia

    const db = this.getDb();
    const ref = db.collection(COLL_OBJECTIVES).doc();

    const newObjective: IObjective = {
      ...data,
      id: ref.id,
    };

    await ref.set(newObjective);
    return newObjective;
  }

  async getObjectivesByClient(clientId: string): Promise<IObjective[]> {
    const snapshot = await this.getDb().collection(COLL_OBJECTIVES)
      .where('clientId', '==', clientId)
      .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as IObjective);
  }

  public async getClientById(clientId: string): Promise<IClient> {
      return this.getClient(clientId);
  }
  
  public async getObjectiveById(objectiveId: string): Promise<IObjective> {
      const doc = await this.getDb().collection(COLL_OBJECTIVES).doc(objectiveId).get();
      if (!doc.exists) {
          throw new NotFoundException(`Objective with ID ${objectiveId} not found.`);
      }
      return { id: doc.id, ...doc.data() } as IObjective;
  }

  // ==========================================
  // 3. GESTIÓN DE CONTRATOS
  // ==========================================

  async createServiceContract(data: Omit<IServiceContract, 'id'>): Promise<IServiceContract> {
    const db = this.getDb();
    const ref = db.collection(COLL_CONTRACTS).doc();
    
    let startDate: admin.firestore.Timestamp;
    
    // Manejo robusto de fechas entrantes (JSON o Date)
    if (data.startDate instanceof admin.firestore.Timestamp) {
        startDate = data.startDate;
    } else if ((data.startDate as any)._seconds) {
        startDate = new admin.firestore.Timestamp((data.startDate as any)._seconds, (data.startDate as any)._nanoseconds);
    } else {
        startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate as any));
    }

    const newContract: IServiceContract = {
      ...data,
      id: ref.id,
      startDate: startDate,
    };

    await ref.set(newContract);
    return newContract;
  }

  // ==========================================
  // 4. GESTIÓN DE MODALIDADES
  // ==========================================

  async createShiftType(data: Omit<IShiftType, 'id'>): Promise<IShiftType> {
    const db = this.getDb();
    const ref = db.collection(COLL_SHIFT_TYPES).doc();

    const newType: IShiftType = {
      ...data,
      id: ref.id,
    };

    await ref.set(newType);
    return newType;
  }

  async getShiftTypesByContract(contractId: string): Promise<IShiftType[]> {
    const snapshot = await this.getDb().collection(COLL_SHIFT_TYPES)
      .where('contractId', '==', contractId)
      .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as IShiftType);
  }
}