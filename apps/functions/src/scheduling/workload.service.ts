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

  // 🛑 ACTUALIZADO: Acepta excludeShiftId para ignorar el turno actual al editar
  async validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date, excludeShiftId?: string): Promise<void> {
    const db = this.getDb();
    
    // Validar existencia del empleado
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    if (!empDoc.exists) throw new BadRequestException('Empleado no encontrado');
    const employee = empDoc.data() as IEmployee;

    // 1. Validar Solapamiento (Conflictos de horario)
    const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd, excludeShiftId);
    if (conflicts.length > 0) {
        // Formateamos la hora para que el error sea claro en el Frontend
        const c = conflicts[0];
        const startStr = (c.startTime as any).toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const endStr = (c.endTime as any).toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        throw new ConflictException(`¡CONFLICTO! ${employee.name} ya cubre un turno de ${startStr} a ${endStr}.`);
    }

    // 2. Validar Disponibilidad (Ausencias/Licencias)
    await this.checkAvailability(employeeId, shiftStart, shiftEnd);
    
    // 3. Validar Límite Mensual de Horas
    await this.checkMonthlyLimit(employee, shiftStart, shiftEnd);
  }

  // 🛑 ACTUALIZADO: Filtra el ID excluido para permitir edición
  async checkShiftOverlap(employeeId: string, start: Date, end: Date, excludeShiftId?: string): Promise<IShift[]> {
    const db = this.getDb();
    
    // Buscamos turnos de este empleado que terminen después de que empiece el nuevo
    // (Optimizamos la query para traer solo candidatos posibles)
    const shiftsQuery = db.collection(SHIFTS_COLLECTION)
        .where('employeeId', '==', employeeId)
        .where('endTime', '>', start);

    const snapshot = await shiftsQuery.get();
    const conflictingShifts: IShift[] = [];

    snapshot.forEach(doc => {
        // 🛑 FIX: Si es el mismo turno que estamos editando, lo ignoramos
        if (excludeShiftId && doc.id === excludeShiftId) return;

        const shift = doc.data(); 
        const sStart = (shift.startTime as admin.firestore.Timestamp).toDate();
        
        // Verificamos intersección de tiempos:
        // (InicioExistente < FinNuevo) AND (FinExistente > InicioNuevo)
        // La query de Firestore ya cubre (FinExistente > InicioNuevo), solo falta validar el inicio.
        if (sStart.getTime() < end.getTime() && shift.status !== 'Canceled') {
             conflictingShifts.push({ id: doc.id, ...shift } as unknown as IShift);
        }
    });
    return conflictingShifts;
  }

  private async checkAvailability(employeeId: string, start: Date, end: Date): Promise<void> {
    const db = this.getDb();
    // Buscamos ausencias que terminen después del inicio del turno
    const absencesSnapshot = await db.collection(ABSENCES_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('endDate', '>=', start)
      .get();

    absencesSnapshot.forEach(doc => {
      const absence = doc.data() as IAbsence;
      const absStart = (absence.startDate as unknown as admin.firestore.Timestamp).toDate();
      const absEnd = (absence.endDate as unknown as admin.firestore.Timestamp).toDate();

      // Verificamos si hay superposición real
      if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
        throw new ConflictException(`BLOQUEO: El empleado está de licencia (${absence.type}) en esas fechas.`);
      }
    });
  }

  private async checkMonthlyLimit(employee: IEmployee, newShiftStart: Date, newShiftEnd: Date): Promise<void> {
    const db = this.getDb();
    
    // Calcular duración del nuevo turno
    const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);
    
    // Definir rango del mes actual
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
      // Ignoramos cancelados
      if (shift.status === 'Canceled') return;

      const sStart = (shift.startTime as admin.firestore.Timestamp).toDate();
      const sEnd = (shift.endTime as admin.firestore.Timestamp).toDate();
      const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
      accumulatedHours += duration;
    });

    const totalProjected = accumulatedHours + newDurationHours;
    const maxHours = employee.maxHoursPerMonth || 176; // Default legal 176hs

    if (totalProjected > maxHours) {
      // Opcional: Podrías solo loguear un warning en lugar de bloquear
      // console.warn(`Límite excedido para ${employee.name}`);
      throw new ConflictException(`LÍMITE EXCEDIDO: Acumulado(${accumulatedHours.toFixed(1)}h) + Nuevo supera el máximo de ${maxHours}h.`);
    }
  }
}