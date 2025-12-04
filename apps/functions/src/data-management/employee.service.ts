import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';

const COLL_EMPLOYEES = 'empleados';

@Injectable()
export class EmployeeService {

  // Inicialización diferida para evitar errores de 'app/no-app'
  private getDb = () => admin.app().firestore();
  private getAuth = () => admin.app().auth();

  /**
   * Obtiene todos los empleados. Si se provee clientId, filtra por esa empresa.
   */
  async findAllEmployees(clientId?: string): Promise<IEmployee[]> {
    try {
      let query: admin.firestore.Query = this.getDb().collection(COLL_EMPLOYEES);

      // 👇 CORRECCIÓN: Filtrado dinámico por Cliente
      if (clientId) {
        query = query.where('clientId', '==', clientId);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => doc.data() as IEmployee);
    } catch (error) {
      console.error('[GET_EMPLOYEES_ERROR]', error);
      throw new InternalServerErrorException('Error al obtener la lista de empleados.');
    }
  }

  /**
   * Actualiza los datos de un empleado (Ej: cambiar límite de horas o rol).
   */
  async updateEmployee(uid: string, data: Partial<IEmployee>): Promise<void> {
    const db = this.getDb();
    const auth = this.getAuth();

    // 1. Actualizar en Firestore
    const ref = db.collection(COLL_EMPLOYEES).doc(uid);
    const doc = await ref.get();

    if (!doc.exists) {
        throw new NotFoundException('Empleado no encontrado.');
    }

    // Protegemos campos inmutables
    delete (data as any).uid;
    delete (data as any).email;

    await ref.update(data);

    // 2. Si cambió el rol, actualizar Custom Claims en Auth
    if (data.role) {
        try {
            await auth.setCustomUserClaims(uid, { role: data.role });
        } catch (e) {
            console.error(`Error actualizando claims para ${uid}`, e);
            // No fallamos todo el proceso, pero logueamos el error
        }
    }
  }

  /**
   * Elimina un empleado (Firestore + Auth).
   */
  async deleteEmployee(uid: string): Promise<void> {
    try {
        // 1. Borrar de Auth (Impide nuevo login)
        await this.getAuth().deleteUser(uid);
        
        // 2. Borrar de Firestore
        await this.getDb().collection(COLL_EMPLOYEES).doc(uid).delete();
    } catch (error) {
        console.error('[DELETE_EMPLOYEE_ERROR]', error);
        throw new InternalServerErrorException('Error al eliminar el empleado.');
    }
  }
}