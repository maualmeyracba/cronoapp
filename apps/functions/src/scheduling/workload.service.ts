import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IEmployee } from '../common/interfaces/employee.interface';
import { IAbsence } from '../common/interfaces/absence.interface';
import { IShift } from '../common/interfaces/shift.interface';
import { startOfWeek, endOfWeek, isSunday, isSaturday, getHours } from 'date-fns';
// Importamos el servicio de convenios para leer reglas dinámicas
import { LaborAgreementService } from '../data-management/labor-agreement.service';

const EMPLOYEES_COLLECTION = 'empleados';
const ABSENCES_COLLECTION = 'ausencias';
const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class WorkloadService {
  private getDb = () => admin.app().firestore();

  constructor(private readonly agreementService: LaborAgreementService) {}

  /**
   * Helper para normalizar fechas de cualquier formato a Date nativo.
   * Fundamental para evitar errores de cálculo de tiempo.
   */
  private toDate(val: any): Date {
      if (!val) return new Date();
      if (val instanceof admin.firestore.Timestamp) return val.toDate();
      if (val._seconds) return new Date(val._seconds * 1000);
      if (typeof val === 'string') return new Date(val);
      return new Date(val);
  }

  /**
   * Helper para calcular el rango de fechas del ciclo de nómina (ej: 26 al 25, o 1 al 30).
   */
  private getCycleDates(shiftDate: Date, startDay: number, endDay: number) {
      const year = shiftDate.getFullYear();
      const month = shiftDate.getMonth();
      let cycleStart, cycleEnd;

      // Validación básica de configuración
      if (startDay >= 1 && startDay <= 31 && (endDay >= 1 && endDay <= 31 || endDay === 0)) {
          
          if (startDay <= endDay || endDay === 0) {
              // Ciclo dentro del mismo mes (Ej: 1 al 30, o 1 al Último día)
              cycleStart = new Date(year, month, startDay, 0, 0, 0);
              cycleEnd = endDay === 0 
                  ? new Date(year, month + 1, 0, 23, 59, 59, 999) 
                  : new Date(year, month, endDay, 23, 59, 59, 999);
          } else {
              // Ciclo cruzado entre meses (Ej: 26 al 25)
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
          // Fallback: Mes calendario (1 al último día)
          cycleStart = new Date(year, month, 1, 0, 0, 0);
          cycleEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      }
      return { cycleStart, cycleEnd };
  }

  /**
   * PUNTO DE ENTRADA PRINCIPAL: Valida reglas y calcula costos.
   */
  async validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date, excludeShiftId?: string): Promise<any> {
    const db = this.getDb();
    
    // 1. Obtener Datos del Empleado
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    if (!empDoc.exists) throw new BadRequestException('Empleado no encontrado');
    const employee = empDoc.data() as IEmployee;

    console.log(`🔍 [Workload] Validando para: ${employee.name} (${employeeId}) | Convenio: ${employee.laborAgreement || 'SUVICO'}`);

    // 2. Obtener Reglas del Convenio (Base de Datos Dinámica)
    const agreementCode = employee.laborAgreement || 'SUVICO';
    let rules = await this.agreementService.getAgreementByCode(agreementCode);
    
    // Fallback de seguridad si no hay reglas cargadas
    if (!rules) {
        console.warn(`⚠️ No se encontraron reglas para ${agreementCode}, usando defaults.`);
        rules = { maxHoursWeekly: 48, maxHoursMonthly: 200, saturdayCutoffHour: 13 } as any; 
    }

    // 3. Validar Solapamiento (Conflictos de horario)
    const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd, excludeShiftId);
    if (conflicts.length > 0) {
        throw new ConflictException(`¡CONFLICTO! Ya tiene un turno asignado en ese horario.`);
    }

    // 4. Validar Disponibilidad (Ausencias / Licencias)
    await this.checkAvailability(employeeId, shiftStart, shiftEnd);

    // 5. 🛑 NUEVO: Validar Límite SEMANAL (48hs o lo que diga el convenio)
    await this.checkWeeklyLimit(employeeId, shiftStart, shiftEnd, rules.maxHoursWeekly, excludeShiftId);

    // 6. Validar Límite MENSUAL (Soft Block con Ciclo)
    await this.checkMonthlyLimit(employee, shiftStart, shiftEnd, excludeShiftId);

    // 7. CÁLCULO DE NÓMINA (Reglas de Convenio para costos)
    const breakdown = await this.calculateShiftBreakdown(employee, startOfWeek(shiftStart), shiftStart, shiftEnd, rules);
    
    return breakdown;
  }

  /**
   * Valida que el empleado no supere el límite de horas semanales (Lunes a Domingo).
   */
  private async checkWeeklyLimit(employeeId: string, start: Date, end: Date, limitWeekly: number, excludeShiftId?: string) {
      const db = this.getDb();
      
      // Semana ISO: Lunes 00:00 a Domingo 23:59
      const weekStart = startOfWeek(start, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(start, { weekStartsOn: 1 });

      const shiftsSnap = await db.collection(SHIFTS_COLLECTION)
          .where('employeeId', '==', employeeId)
          .where('startTime', '>=', admin.firestore.Timestamp.fromDate(weekStart))
          .where('startTime', '<=', admin.firestore.Timestamp.fromDate(weekEnd))
          .get();

      let accumulatedHours = 0;
      shiftsSnap.forEach(doc => {
          if (excludeShiftId && doc.id === excludeShiftId) return;
          const data = doc.data();
          if (data.status === 'Canceled') return;
          
          const s = this.toDate(data.startTime);
          const e = this.toDate(data.endTime);
          accumulatedHours += (e.getTime() - s.getTime()) / (1000 * 60 * 60);
      });

      const newDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const totalProjected = accumulatedHours + newDuration;

      // 🛑 SI SE PASA DEL LÍMITE SEMANAL -> ALERTA
      if (totalProjected > limitWeekly) {
          const excess = (totalProjected - limitWeekly).toFixed(1);
          throw new ConflictException(
              `LÍMITE SEMANAL EXCEDIDO: ${totalProjected.toFixed(1)}h esta semana (Máx: ${limitWeekly}h). Exceso: ${excess}h.`
          );
      }
  }

  /**
   * MOTOR DE CÁLCULO DE COSTOS (Normal, 50%, 100%)
   * Se simplifica delegando en las reglas pasadas como parámetro.
   */
  async calculateShiftBreakdown(employee: IEmployee, weekStart: Date, start: Date, end: Date, rules: any) {
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      // Aquí se podría expandir para calcular el desglose exacto de horas al 50/100
      // para guardarlo en la ficha del turno, pero el bloqueo preventivo ya se hizo arriba.
      
      return {
          totalDuration: duration,
          breakdown: { normal: duration, fifty: 0, hundred: 0, night: 0 }, // Placeholder para futura expansión
          agreementUsed: rules.code || 'STANDARD'
      };
  }

  // --- VALIDACIONES AUXILIARES ---

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
        
        // Verificamos intersección real
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

      // Verificamos superposición
      if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
        throw new ConflictException(`⛔ BLOQUEO: Licencia activa (${absence.type}).`);
      }
    });
  }

  private async checkMonthlyLimit(employee: IEmployee, newShiftStart: Date, newShiftEnd: Date, excludeShiftId?: string): Promise<void> {
    const db = this.getDb();
    const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);
    
    // Usar ciclo configurado (dinámico)
    const { cycleStart, cycleEnd } = this.getCycleDates(
        newShiftStart, 
        employee.payrollCycleStartDay || 1, 
        employee.payrollCycleEndDay || 0
    );

    console.log(`📊 [Workload] Calculando ciclo para Soft Block: ${cycleStart.toISOString()} - ${cycleEnd.toISOString()}`);

    const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
      .where('employeeId', '==', employee.uid)
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(cycleStart))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(cycleEnd))
      .get();

    let accumulatedHours = 0;

    shiftsSnapshot.forEach(doc => {
      if (excludeShiftId && doc.id === excludeShiftId) return;
      const shift = doc.data();
      // Solo sumamos turnos válidos
      if (shift.status !== 'Canceled' && shift.status !== 'Completed') {
          const sStart = this.toDate(shift.startTime);
          const sEnd = this.toDate(shift.endTime);
          accumulatedHours += (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
      }
    });

    const totalProjected = accumulatedHours + newDurationHours;
    const maxHours = Number(employee.maxHoursPerMonth) || 176; 

    if (totalProjected > maxHours) {
      const exceeded = (totalProjected - maxHours).toFixed(1);
      throw new ConflictException(`LÍMITE MENSUAL EXCEDIDO: ${employee.name} llega a ${totalProjected.toFixed(1)}h (Máx: ${maxHours}h). Exceso: ${exceeded}h.`);
    }
  }

  // --- REPORTE PARA RRHH (Auditoría) ---
  async getWorkloadReport(employeeId: string, month: number, year: number): Promise<any> {
    const db = this.getDb();

    // Usamos una fecha intermedia (día 15) para determinar en qué ciclo cae
    const dateForCycle = new Date(year, month - 1, 15); 
    
    const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
    const employee = empDoc.exists ? empDoc.data() as IEmployee : null;
    const maxHours = Number(employee?.maxHoursPerMonth) || 176;

    // Calcular ciclo usando la configuración del empleado
    const { cycleStart, cycleEnd } = this.getCycleDates(
        dateForCycle, 
        employee?.payrollCycleStartDay || 1, 
        employee?.payrollCycleEndDay || 0 
    );
    
    // Consulta con Timestamp
    const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
      .where('employeeId', '==', employeeId)
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(cycleStart))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(cycleEnd))
      .get();

    let assignedHours = 0;
    let completedHours = 0;
    const details = [];

    shiftsSnapshot.forEach(doc => {
      const shift = doc.data() as IShift;
      const sStart = this.toDate(shift.startTime);
      const sEnd = this.toDate(shift.endTime);
      const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
      const status = shift.status;

      // Asignadas: Todo lo que no está cancelado ni completado (pendiente o en curso)
      if (status !== 'Canceled' && status !== 'Completed') assignedHours += duration;
      // Trabajadas: Solo lo completado
      if (status === 'Completed') completedHours += duration;
      
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
      cycleStart: cycleStart.toLocaleDateString('es-AR'),
      cycleEnd: cycleEnd.toLocaleDateString('es-AR'),
      details: details.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }
}