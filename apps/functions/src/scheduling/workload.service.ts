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

  private toDate(val: any): Date {
      if (!val) return new Date();
      if (val instanceof admin.firestore.Timestamp) return val.toDate();
      if (val._seconds) return new Date(val._seconds * 1000);
      if (typeof val === 'string') return new Date(val);
      return new Date(val);
  }

  // 🛑 NUEVO HELPER: Determina el rango de fechas basado en el ciclo de nómina del empleado
  private getCycleDates(shiftDate: Date, startDay: number, endDay: number) {
      const year = shiftDate.getFullYear();
      const month = shiftDate.getMonth();
      let cycleStart, cycleEnd;

      // Usar ciclo de nómina solo si está configurado (días 1-31)
      if (startDay >= 1 && startDay <= 31 && (endDay >= 1 && endDay <= 31 || endDay === 0)) {
          
          if (startDay <= endDay || endDay === 0) {
              // Ciclo dentro del mismo mes (Ej: 1 al 30, o 1 al Último día (endDay=0))
              cycleStart = new Date(year, month, startDay, 0, 0, 0);
              // Si endDay es 0, usamos el último día del mes actual. Si no, usamos endDay.
              cycleEnd = endDay === 0 
                  ? new Date(year, month + 1, 0, 23, 59, 59, 999) 
                  : new Date(year, month, endDay, 23, 59, 59, 999);

          } else {
              // Ciclo que cruza meses (Ej: 15 al 14)
              if (shiftDate.getDate() >= startDay) {
                  // El turno pertenece al ciclo que termina el próximo mes
                  cycleStart = new Date(year, month, startDay, 0, 0, 0);
                  cycleEnd = new Date(year, month + 1, endDay, 23, 59, 59, 999);
              } else {
                  // El turno pertenece al ciclo que empezó el mes anterior
                  cycleStart = new Date(year, month - 1, startDay, 0, 0, 0);
                  cycleEnd = new Date(year, month, endDay, 23, 59, 59, 999);
              }
          }
      } else {
          // Fallback: Usar mes calendario (1 al último día)
          cycleStart = new Date(year, month, 1, 0, 0, 0);
          cycleEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      }
      return { cycleStart, cycleEnd };
  }


  async validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date, excludeShiftId?: string): Promise<void> {
    const db = this.getDb();
    
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    if (!empDoc.exists) throw new BadRequestException('Empleado no encontrado');
    const employee = empDoc.data() as IEmployee;

    console.log(`🔍 [Workload] Validando carga para: ${employee.name} (${employeeId})`);

    const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd, excludeShiftId);
    if (conflicts.length > 0) {
        const c = conflicts[0];
        const s = new Date(this.toDate(c.startTime).getTime() - 10800000); 
        const e = new Date(this.toDate(c.endTime).getTime() - 10800000);
        const timeStr = `${s.toISOString().substring(11,16)} - ${e.toISOString().substring(11,16)}`;
        throw new ConflictException(`¡CONFLICTO! Ya tiene un turno asignado en ese horario: ${timeStr}`);
    }

    await this.checkAvailability(employeeId, shiftStart, shiftEnd);
    await this.checkMonthlyLimit(employee, shiftStart, shiftEnd, excludeShiftId);
  }

  async checkShiftOverlap(employeeId: string, start: Date, end: Date, excludeShiftId?: string): Promise<IShift[]> {
    const db = this.getDb();
    
    const shiftsQuery = db.collection(SHIFTS_COLLECTION)
        .where('employeeId', '==', employeeId)
        .where('endTime', '>', admin.firestore.Timestamp.fromDate(start)); 

    const snapshot = await shiftsQuery.get();
    const conflictingShifts: IShift[] = [];

    snapshot.forEach(doc => {
        if (excludeShiftId && doc.id === excludeShiftId) return;
        const shift = doc.data(); 
        if (shift.status === 'Canceled') return;

        const sStart = this.toDate(shift.startTime);
        
        if (sStart.getTime() < end.getTime()) {
             conflictingShifts.push({ id: doc.id, ...shift } as unknown as IShift);
        }
    });
    return conflictingShifts;
  }

  private async checkAvailability(employeeId: string, start: Date, end: Date): Promise<void> {
    const db = this.getDb();
    const absencesSnapshot = await db.collection(ABSENCES_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('status', 'in', ['APPROVED', 'PENDING'])
      .get();

    absencesSnapshot.forEach(doc => {
      const absence = doc.data() as IAbsence;
      const absStart = this.toDate(absence.startDate);
      const absEnd = this.toDate(absence.endDate);

      if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
        throw new ConflictException(`⛔ BLOQUEO: Licencia activa (${absence.type}).`);
      }
    });
  }

  /**
   * Calcula las horas acumuladas del mes (o ciclo de nómina) y valida contra el límite.
   */
  private async checkMonthlyLimit(employee: IEmployee, newShiftStart: Date, newShiftEnd: Date, excludeShiftId?: string): Promise<void> {
    const db = this.getDb();
    
    const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);

    // 🛑 FIX CLAVE: USAR EL CICLO DE NÓMINA CONFIGURADO
    const { cycleStart: startOfCycle, cycleEnd: endOfCycle } = this.getCycleDates(
        newShiftStart, 
        employee.payrollCycleStartDay || 1, 
        employee.payrollCycleEndDay || 0
    );

    console.log(`📊 [Workload] Calculando ciclo: ${startOfCycle.toISOString()} a ${endOfCycle.toISOString()}`);

    const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
      .where('employeeId', '==', employee.uid)
      // Usar Timestamp para la consulta (FIX CRÍTICO)
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfCycle))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfCycle))
      .get();

    let accumulatedHours = 0;
    let count = 0;

    shiftsSnapshot.forEach(doc => {
      if (excludeShiftId && doc.id === excludeShiftId) return;
      const shift = doc.data();
      
      // Sumamos solo turnos Asignados o En Curso.
      if (shift.status !== 'Canceled' && shift.status !== 'Completed') {
          const sStart = this.toDate(shift.startTime);
          const sEnd = this.toDate(shift.endTime);
          const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
          accumulatedHours += duration;
          count++;
      }
    });

    const totalProjected = accumulatedHours + newDurationHours;
    const maxHours = Number(employee.maxHoursPerMonth) || 176; 

    if (totalProjected > maxHours) {
      const exceeded = (totalProjected - maxHours).toFixed(1);
      throw new ConflictException(`LÍMITE EXCEDIDO: ${employee.name} llega a ${totalProjected.toFixed(1)}h (Máx: ${maxHours}h). Exceso: ${exceeded}h. (Ciclo: ${startOfCycle.toLocaleDateString()} - ${endOfCycle.toLocaleDateString()})`);
    }
  }

  /**
   * Genera el reporte de carga laboral para el módulo RRHH.
   */
  async getWorkloadReport(employeeId: string, month: number, year: number): Promise<any> {
    const db = this.getDb();

    // Usamos una fecha intermedia para caer en el ciclo de nómina correcto.
    const dateForCycle = new Date(year, month - 1, 15); 
    
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    const employee = empDoc.exists ? empDoc.data() as IEmployee : null;
    const maxHours = Number(employee?.maxHoursPerMonth) || 176;

    // 🛑 FIX CLAVE: USAR EL CICLO DE NÓMINA CONFIGURADO para el reporte
    const { cycleStart: startOfCycle, cycleEnd: endOfCycle } = this.getCycleDates(
        dateForCycle, 
        employee?.payrollCycleStartDay || 1, 
        employee?.payrollCycleEndDay || 0 
    );
    
    // 2. Consulta de turnos (Usando Timestamp)
    const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfCycle))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfCycle))
      .get();

    let assignedHours = 0;
    let completedHours = 0;
    const details = [];

    // 3. Procesar y totalizar
    shiftsSnapshot.forEach(doc => {
      const shift = doc.data() as IShift;
      const sStart = this.toDate(shift.startTime);
      const sEnd = this.toDate(shift.endTime);
      const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
      const status = shift.status;

      // Sumamos solo a Assigned/InProgress (el total que cuenta el Soft Block)
      if (status !== 'Canceled' && status !== 'Completed') {
        assignedHours += duration;
      }
      
      // Sumamos Completed para auditoría
      if (status === 'Completed') {
        completedHours += duration;
      }
      
      details.push({
        shiftId: doc.id,
        objectiveName: shift.objectiveName,
        duration: parseFloat(duration.toFixed(1)),
        status: status,
        date: sStart.toLocaleDateString('es-AR'),
        startTime: sStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      });
    });

    return {
      assignedHours: parseFloat(assignedHours.toFixed(1)), 
      completedHours: parseFloat(completedHours.toFixed(1)),
      maxHours,
      cycleStart: startOfCycle.toLocaleDateString('es-AR'),
      cycleEnd: endOfCycle.toLocaleDateString('es-AR'),
      details: details.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }
}