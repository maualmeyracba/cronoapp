import { Injectable, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IShift } from '../common/interfaces/shift.interface';
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
import * as functions from 'firebase-functions';

const SHIFTS_COLLECTION = 'turnos';
const ABSENCES_COLLECTION = 'ausencias'; // ⚠️ VERIFICA QUE ESTE SEA EL NOMBRE EXACTO EN TU BD

@Injectable()
export class SchedulingService {
  private getDb = () => admin.app().firestore();

  constructor(
    private readonly overlapService: ShiftOverlapService,
    private readonly workloadService: WorkloadService
  ) {}

  // Helper para normalizar fechas a objetos Date nativos de JS
  private convertToDate(input: any): Date {
    if (!input) return new Date(); // Fallback de seguridad
    if (input instanceof admin.firestore.Timestamp) return input.toDate();
    if (typeof input.toDate === 'function') return input.toDate();
    if (input._seconds !== undefined) return new Date(input._seconds * 1000);
    // Si viene como string ISO o Date object
    return new Date(input);
  }

  // 🛑 VALIDACIÓN DE AUSENCIAS (STRICT)
  private async checkAbsenceConflict(employeeId: string, shiftStart: Date, shiftEnd: Date): Promise<void> {
      if (employeeId === 'VACANTE') return;

      const db = this.getDb();
      console.log(`🕵️‍♂️ Validando ausencias para ${employeeId} entre ${shiftStart.toISOString()} y ${shiftEnd.toISOString()}`);

      // Consultamos ausencias activas
      const absencesSnap = await db.collection(ABSENCES_COLLECTION)
          .where('employeeId', '==', employeeId)
          // No filtramos por fecha en la query para evitar problemas de índices complejos por ahora,
          // filtramos en memoria que es más seguro para rangos.
          .get();

      if (absencesSnap.empty) {
          console.log("✅ No se encontraron registros de ausencia para este empleado.");
          return;
      }

      // Revisión manual de solapamiento
      const conflict = absencesSnap.docs.find(doc => {
          const data = doc.data();
          
          // Ignoramos si está rechazada o cancelada
          if (data.status === 'rejected' || data.status === 'cancelled') return false;

          const absStart = this.convertToDate(data.startDate);
          const absEnd = this.convertToDate(data.endDate);

          // Ajuste de "Día Completo": Si la ausencia termina a las 00:00 del día X, 
          // a veces se registra como el inicio del día siguiente. 
          // Aseguramos comparar milisegundos.
          
          const shiftStartMs = shiftStart.getTime();
          const shiftEndMs = shiftEnd.getTime();
          const absStartMs = absStart.getTime();
          const absEndMs = absEnd.getTime();

          console.log(`   --> Comparando con Ausencia: ${absStart.toISOString()} - ${absEnd.toISOString()} (${data.type || 'Licencia'})`);

          // Lógica de Solapamiento Estándar: (StartA < EndB) and (EndA > StartB)
          const isOverlapping = (shiftStartMs < absEndMs) && (shiftEndMs > absStartMs);
          
          if (isOverlapping) {
              console.warn(`   ⛔ CONFLICTO DETECTADO con ausencia ID: ${doc.id}`);
          }
          
          return isOverlapping;
      });

      if (conflict) {
          const data = conflict.data();
          throw new functions.https.HttpsError(
              'failed-precondition', 
              `⛔ BLOQUEO: El empleado está de licencia/ausente (${data.type || 'Motivo no especificado'}) en esas fechas.`
          );
      }
  }

  // --- CREAR TURNO INDIVIDUAL ---
  async assignShift(shiftData: Partial<IShift>, userAuth: admin.auth.DecodedIdToken): Promise<IShift> {
    const dbInstance = this.getDb();
    const newShiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc();

    if (!shiftData.startTime || !shiftData.endTime || !shiftData.employeeId || !shiftData.objectiveId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos.');
    }
    
    let newStart: Date;
    let newEnd: Date;
    try {
        newStart = this.convertToDate(shiftData.startTime);
        newEnd = this.convertToDate(shiftData.endTime);
    } catch (e) { throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.'); }
    
    const employeeId = shiftData.employeeId!;
    if (newStart.getTime() >= newEnd.getTime()) throw new BadRequestException('Horario inválido (Inicio >= Fin).');

    // 1. VALIDACIÓN: CARGA LABORAL (Límite de Horas)
    // Asumimos que WorkloadService lanza una excepción si falla.
    if (employeeId !== 'VACANTE') {
        try {
            await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
        } catch (error: any) {
            console.warn(`⛔ Workload Block: ${error.message}`);
            // Re-lanzamos como error HTTP para que el frontend lo muestre en rojo
            throw new functions.https.HttpsError('resource-exhausted', error.message || 'El empleado excede el límite de horas.');
        }
    }

    // 2. VALIDACIÓN: AUSENCIAS
    await this.checkAbsenceConflict(employeeId, newStart, newEnd);

    // 3. TRANSACCIÓN (Validación de Solapamiento de Turnos)
    try {
      await dbInstance.runTransaction(async (transaction) => {
        if (employeeId !== 'VACANTE') {
            const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
              .where('employeeId', '==', employeeId)
              .where('endTime', '>', newStart) 
              // Limitamos búsqueda para optimizar, pero cuidado si hay muchos turnos futuros
              .orderBy('endTime') 
              .limit(5); 

            const snapshot = await transaction.get(overlappingQuery);
            
            const hasOverlap = snapshot.docs.some(doc => {
                const data = doc.data();
                if (data.status === 'Canceled') return false;
                
                const existStart = this.convertToDate(data.startTime);
                const existEnd = this.convertToDate(data.endTime);
                
                // Verificar intersección real
                return this.overlapService.isOverlap(existStart, existEnd, newStart, newEnd);
            });

            if (hasOverlap) {
                throw new functions.https.HttpsError('already-exists', '⛔ El empleado ya tiene OTRO TURNO asignado que se superpone con este horario.');
            }
        }
        
        const finalShift: IShift = {
          id: newShiftRef.id,
          employeeId,
          objectiveId: shiftData.objectiveId!,
          employeeName: shiftData.employeeName || 'S/D', 
          objectiveName: shiftData.objectiveName || 'S/D',
          startTime: admin.firestore.Timestamp.fromDate(newStart), 
          endTime: admin.firestore.Timestamp.fromDate(newEnd),
          status: 'Assigned',
          schedulerId: userAuth.uid,
          updatedAt: admin.firestore.Timestamp.now(),
          role: (shiftData as any).role || 'Vigilador' 
        };

        transaction.set(newShiftRef, finalShift);
      });
      
      return { id: newShiftRef.id, ...shiftData } as IShift;

    } catch (error: any) {
        // Aseguramos que el error llegue limpio al cliente
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Error interno al asignar turno.');
    }
  }

  // --- EDITAR TURNO (Move / Update) ---
  async updateShift(shiftId: string, updateData: Partial<IShift>): Promise<void> {
      const db = this.getDb();
      const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
      
      const currentDoc = await shiftRef.get();
      if (!currentDoc.exists) throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
      
      const currentShift = currentDoc.data() as IShift;

      // Determinamos los valores finales (nuevos o existentes)
      const effectiveEmployeeId = updateData.employeeId || currentShift.employeeId;
      const effectiveStart = updateData.startTime ? this.convertToDate(updateData.startTime) : this.convertToDate(currentShift.startTime);
      const effectiveEnd = updateData.endTime ? this.convertToDate(updateData.endTime) : this.convertToDate(currentShift.endTime);

      const isRealEmployee = effectiveEmployeeId !== 'VACANTE';
      
      // Detectar si cambió algo relevante para re-validar
      const datesChanged = (updateData.startTime || updateData.endTime);
      const employeeChanged = (updateData.employeeId && updateData.employeeId !== currentShift.employeeId);

      if (isRealEmployee && (datesChanged || employeeChanged)) {
           console.log(`🔄 Validando actualización para ${effectiveEmployeeId}...`);

           // 1. Validar Carga
           try {
               // Excluimos el turno actual (shiftId) del conteo para no auto-bloquearse
               await this.workloadService.validateAssignment(effectiveEmployeeId, effectiveStart, effectiveEnd, shiftId);
           } catch (e: any) {
               throw new functions.https.HttpsError('resource-exhausted', `⛔ Límite de Horas: ${e.message}`);
           }

           // 2. Validar Ausencias
           await this.checkAbsenceConflict(effectiveEmployeeId, effectiveStart, effectiveEnd);
           
           // 3. Validar Solapamiento (Simple check sin transacción por performance en update, pero seguro)
           const overlap = await this.checkOverlapSimple(effectiveEmployeeId, effectiveStart, effectiveEnd, shiftId);
           if (overlap) {
               throw new functions.https.HttpsError('already-exists', '⛔ Solapamiento: El empleado ya trabaja en ese horario en otro lugar.');
           }
      }

      const safeUpdate = { ...updateData };
      delete (safeUpdate as any).id; 
      
      if (safeUpdate.startTime) safeUpdate.startTime = admin.firestore.Timestamp.fromDate(effectiveStart);
      if (safeUpdate.endTime) safeUpdate.endTime = admin.firestore.Timestamp.fromDate(effectiveEnd);
      
      safeUpdate.updatedAt = admin.firestore.Timestamp.now();
      
      await shiftRef.update(safeUpdate);
  }

  // Helper simple para overlap fuera de transacción
  private async checkOverlapSimple(employeeId: string, start: Date, end: Date, excludeShiftId: string): Promise<boolean> {
      const db = this.getDb();
      const snapshot = await db.collection(SHIFTS_COLLECTION)
          .where('employeeId', '==', employeeId)
          .where('endTime', '>', start)
          .get();

      return snapshot.docs.some(doc => {
          if (doc.id === excludeShiftId) return false; // Ignoramos el turno que estamos editando
          const data = doc.data();
          if (data.status === 'Canceled') return false;
          const s = this.convertToDate(data.startTime);
          const e = this.convertToDate(data.endTime);
          return this.overlapService.isOverlap(s, e, start, end);
      });
  }

  async deleteShift(shiftId: string): Promise<void> {
      const db = this.getDb();
      await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
  }

  // --- REPLICAR ESTRUCTURA (Mantenemos la versión corregida anterior) ---
  async replicateDailyStructure(
    objectiveId: string, 
    sourceDateStr: string, 
    targetStartDateStr: string, 
    targetEndDateStr: string, 
    schedulerId: string,
    targetDays?: number[]
  ): Promise<{ created: number, skipped: number }> {
    const db = this.getDb();
    const TZ_OFFSET_HOURS = 3; 
    const sourceDate = new Date(sourceDateStr + 'T00:00:00');
    const startSource = new Date(sourceDate); startSource.setHours(startSource.getHours() + TZ_OFFSET_HOURS);
    const endSource = new Date(startSource); endSource.setHours(startSource.getHours() + 23, 59, 59, 999);

    const sourceShiftsSnap = await db.collection(SHIFTS_COLLECTION)
        .where('objectiveId', '==', objectiveId)
        .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startSource))
        .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endSource))
        .get();

    if (sourceShiftsSnap.empty) throw new functions.https.HttpsError('not-found', 'El día origen no tiene turnos.');

    const sourceShifts = sourceShiftsSnap.docs.map(doc => doc.data() as IShift).filter(s => s.status !== 'Canceled');
    const batch = db.batch();
    let opCount = 0;
    let skipped = 0;
    const MAX_BATCH_SIZE = 450; 
    const allowedDays = targetDays && targetDays.length > 0 ? targetDays : [0,1,2,3,4,5,6];

    const startTarget = new Date(targetStartDateStr + 'T00:00:00');
    const endTarget = new Date(targetEndDateStr + 'T00:00:00');
    const loopStart = new Date(startTarget); 
    const loopEnd = new Date(endTarget);

    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        if (!allowedDays.includes(d.getDay())) continue;

        const dayStartUTC = new Date(d);
        dayStartUTC.setHours(dayStartUTC.getHours() + TZ_OFFSET_HOURS);
        const dayEndUTC = new Date(dayStartUTC);
        dayEndUTC.setHours(dayStartUTC.getHours() + 23, 59, 59, 999);
        
        const existingCheck = await db.collection(SHIFTS_COLLECTION)
            .where('objectiveId', '==', objectiveId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(dayStartUTC))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(dayEndUTC))
            .get();

        if (existingCheck.empty) { skipped++; continue; }

        const existingShifts = existingCheck.docs.map(doc => ({ ref: doc.ref, data: doc.data() as IShift }));
        const hasRealEmployees = existingShifts.some(s => s.data.employeeId !== 'VACANTE' && s.data.status !== 'Canceled');

        if (hasRealEmployees) { skipped++; continue; }

        existingShifts.forEach(s => { batch.delete(s.ref); opCount++; });

        for (const template of sourceShifts) {
            const tStart = this.convertToDate(template.startTime);
            const tEnd = this.convertToDate(template.endTime);
            const msFromStartOfDay = tStart.getTime() - startSource.getTime();
            const durationMs = tEnd.getTime() - tStart.getTime();
            const newStart = new Date(dayStartUTC.getTime() + msFromStartOfDay);
            const newEnd = new Date(newStart.getTime() + durationMs);

            const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
            const newShift: IShift = {
                id: newShiftRef.id,
                objectiveId: objectiveId,
                objectiveName: template.objectiveName,
                employeeId: template.employeeId, 
                employeeName: template.employeeName,
                role: template.role || 'Vigilador',
                startTime: admin.firestore.Timestamp.fromDate(newStart),
                endTime: admin.firestore.Timestamp.fromDate(newEnd),
                status: 'Assigned',
                schedulerId: schedulerId,
                updatedAt: admin.firestore.Timestamp.now()
            };
            batch.set(newShiftRef, newShift);
            opCount++;
            if (opCount >= MAX_BATCH_SIZE) break;
        }
        if (opCount >= MAX_BATCH_SIZE) break;
    }

    if (opCount > 0) await batch.commit();
    return { created: opCount, skipped };
  }
}