import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';

@Injectable()
export class EmployeeService {
  // Inicialización diferida del DB
  private getDb = () => admin.app().firestore();
  private readonly collectionName = 'empleados';

  /**
   * Obtiene la lista de empleados.
   * 🛑 CAMBIO: Soporta filtrado por 'clientId' para multi-tenancy.
   * @param clientId (Opcional) ID de la empresa para filtrar.
   */
  async findAllEmployees(clientId?: string): Promise<IEmployee[]> {
    const db = this.getDb();
    let query: admin.firestore.Query = db.collection(this.collectionName);

    // Si se provee un clientId, aplicamos el filtro
    if (clientId) {
        query = query.where('clientId', '==', clientId);
    }

    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            uid: doc.id, 
            ...data 
        } as IEmployee;
    });
  }

  async updateEmployee(uid: string, data: Partial<IEmployee>): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collectionName).doc(uid).update(data);
  }

  async deleteEmployee(uid: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collectionName).doc(uid).delete();
  }
}