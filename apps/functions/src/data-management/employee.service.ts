import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';
import { WorkloadService } from '../scheduling/workload.service';

const COLL_EMPLOYEES = 'empleados';

@Injectable()
export class EmployeeService {

  private getDb = () => admin.app().firestore();
  private getAuth = () => admin.app().auth();

  constructor(
      private readonly workloadService: WorkloadService, 
  ) {}

  async findAllEmployees(clientId?: string): Promise<IEmployee[]> {
    try {
      let query: admin.firestore.Query = this.getDb().collection(COLL_EMPLOYEES);
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

  async getEmployeeWorkload(uid: string, month: number, year: number): Promise<any> {
    // Reutiliza la lógica de reporte actualizada
    const report = await this.workloadService.getWorkloadReport(uid, month, year);
    return report;
  }

  /**
   * Actualiza los datos de un empleado, incluyendo los días de ciclo de nómina.
   */
  async updateEmployee(uid: string, data: Partial<IEmployee>): Promise<void> {
      const db = this.getDb();
      const auth = this.getAuth();
      const ref = db.collection(COLL_EMPLOYEES).doc(uid);
      const doc = await ref.get();
      if (!doc.exists) {
          throw new NotFoundException('Empleado no encontrado.');
      }

      // Asegurar que los días de ciclo sean números
      const updateData: any = { ...data };
      if (updateData.payrollCycleStartDay !== undefined) updateData.payrollCycleStartDay = Number(updateData.payrollCycleStartDay);
      if (updateData.payrollCycleEndDay !== undefined) updateData.payrollCycleEndDay = Number(updateData.payrollCycleEndDay);

      delete updateData.uid;
      delete updateData.email;
      await ref.update(updateData);

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
        await this.getAuth().deleteUser(uid);
        await this.getDb().collection(COLL_EMPLOYEES).doc(uid).delete();
    } catch (error) {
        console.error('[DELETE_EMPLOYEE_ERROR]', error);
        throw new InternalServerErrorException('Error al eliminar el empleado.');
    }
  }
}