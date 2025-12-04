import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';

const COLL_EMPLOYEES = 'empleados';

@Injectable()
export class EmployeeService {
  // Inicialización diferida
  private getDb = () => admin.app().firestore();
  private getAuth = () => admin.app().auth();

  /**
   * Obtiene empleados, opcionalmente filtrados por empresa.
   * 🛑 FIX: Aceptamos el argumento clientId para que index.ts no falle.
   */
  async findAllEmployees(clientId?: string): Promise<IEmployee[]> {
    try {
      const db = this.getDb();
      let query: admin.firestore.Query = db.collection(COLL_EMPLOYEES);

      // Si se provee un clientId, filtramos la consulta
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
    } catch (error) {
      console.error('[GET_EMPLOYEES_ERROR]', error);
      throw new InternalServerErrorException('Error al obtener la lista de empleados.');
    }
  }

  async updateEmployee(uid: string, data: Partial<IEmployee>): Promise<void> {
    const db = this.getDb();
    const auth = this.getAuth();
    const ref = db.collection(COLL_EMPLOYEES).doc(uid);
    const doc = await ref.get();
    
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado.');

    // Protegemos campos críticos
    const safeData = { ...data };
    delete (safeData as any).uid;
    delete (safeData as any).email;
    
    await ref.update(safeData);

    // Sincronizar Rol en Auth si cambia
    if (data.role) {
        try {
            await auth.setCustomUserClaims(uid, { role: data.role });
        } catch (e) {
            console.error(`Error actualizando claims para ${uid}`, e);
        }
    }
  }

  async deleteEmployee(uid: string): Promise<void> {
    try {
        // Borrado completo: Auth + Firestore
        await this.getAuth().deleteUser(uid);
        await this.getDb().collection(COLL_EMPLOYEES).doc(uid).delete();
    } catch (error) {
        console.error('[DELETE_EMPLOYEE_ERROR]', error);
        throw new InternalServerErrorException('Error al eliminar el empleado.');
    }
  }
}