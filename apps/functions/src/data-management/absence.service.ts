import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';
import { IAbsence } from '../common/interfaces/absence.interface';
import { IShift } from '../common/interfaces/shift.interface';

const EMPLOYEES_COLLECTION = 'empleados';
const ABSENCES_COLLECTION = 'ausencias';
const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class WorkloadService {
  private getDb = () => admin.app().firestore();

  async validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date): Promise<void> {
    const db = this.getDb();
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    
    if (!empDoc.exists) throw new BadRequestException('Employee not found');
    const employee = empDoc.data() as IEmployee;

    // 1. Solapamiento (Llama al método nuevo)
    const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd);
    if (conflicts.length > 0) {
        throw new ConflictException('SOLAPAMIENTO DETECTADO: El empleado ya tiene un turno asignado en este período.');
    }

    // 2. Disponibilidad
    await this.checkAvailability(employeeId, shiftStart, shiftEnd);

    // 3. Límite Mensual
    await this.checkMonthlyLimit(employee, shiftStart, shiftEnd);
  }

  // 🛑 MÉTODO QUE FALTABA EN TU CÓDIGO
  async checkShiftOverlap(employeeId: string, start: Date, end: Date): Promise<IShift[]> {
    const db = this.getDb();
    const shiftsQuery = db.collection(SHIFTS_COLLECTION)
        .where('employeeId', '==', employeeId)
        .where('endTime', '>', start);

    const snapshot = await shiftsQuery.get();
    const conflictingShifts: IShift[] = [];

    snapshot.forEach(doc => {
        const shift = doc.data(); 
        const sStart = (shift.startTime as admin.firestore.Timestamp).toDate();
        
        if (sStart.getTime() < end.getTime()) {
             // Doble casting para evitar error de tipos
             conflictingShifts.push({ id: doc.id, ...shift } as unknown as IShift);
        }
    });
    return conflictingShifts;
  }

  private async checkAvailability(employeeId: string, start: Date, end: Date): Promise<void> {
    const db = this.getDb();
    const absencesSnapshot = await db.collection(ABSENCES_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('endDate', '>=', start)
      .get();

    absencesSnapshot.forEach(doc => {
      const absence = doc.data() as IAbsence;
      const absStart = (absence.startDate as unknown as admin.firestore.Timestamp).toDate();
      const absEnd = (absence.endDate as unknown as admin.firestore.Timestamp).toDate();

      if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
        throw new ConflictException(`BLOQUEO: El empleado está ausente por: ${absence.type}`);
      }
    });
  }

  private async checkMonthlyLimit(employee: IEmployee, newShiftStart: Date, newShiftEnd: Date): Promise<void> {
    const db = this.getDb();
    const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);
    const startOfMonth = new Date(newShiftStart.getFullYear(), newShiftStart.getMonth(), 1);
    const endOfMonth = new Date(newShiftStart.getFullYear(), newShiftStart.getMonth() + 1, 0, 23, 59, 59);

    const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
      .where('employeeId', '==', employee.uid)
      .where('startTime', '>=', startOfMonth)
      .where('startTime', '<=', endOfMonth)
      .get();

    let accumulatedHours = 0;
    shiftsSnapshot.forEach(doc => {
      const shift = doc.data();
      const sStart = (shift.startTime as admin.firestore.Timestamp).toDate();
      const sEnd = (shift.endTime as admin.firestore.Timestamp).toDate();
      const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
      accumulatedHours += duration;
    });

    const totalProjected = accumulatedHours + newDurationHours;
    const maxHours = employee.maxHoursPerMonth || 176;

    if (totalProjected > maxHours) {
      throw new ConflictException(`LÍMITE EXCEDIDO: Acumulado(${accumulatedHours.toFixed(1)}h) + Nuevo supera el máximo.`);
    }
  }
}