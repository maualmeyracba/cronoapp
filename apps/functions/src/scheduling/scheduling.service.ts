import { Injectable, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IShift } from '../common/interfaces/shift.interface';
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
import * as functions from 'firebase-functions';

const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class SchedulingService {
  private getDb = () => admin.app().firestore();

  constructor(
    private readonly overlapService: ShiftOverlapService,
    private readonly workloadService: WorkloadService
  ) {}

  private convertToDate(input: any): Date {
    if (!input) throw new Error('Fecha inválida.');
    if (typeof input.toDate === 'function') return input.toDate();
    if (input._seconds !== undefined) return new Date(input._seconds * 1000);
    if (input.seconds !== undefined) return new Date(input.seconds * 1000);
    return new Date(input);
  }

  // --- CREAR TURNO INDIVIDUAL (Desde cero) ---
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
    if (newStart.getTime() >= newEnd.getTime()) throw new BadRequestException('Horario inválido.');

    // Validar Reglas de Negocio
    try {
        await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
    } catch (businessRuleError: any) {
        console.warn(`[BUSINESS_RULE] ${businessRuleError.message}`);
        if (employeeId !== 'VACANTE') {
             throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
        }
    }

    // Transacción para asegurar consistencia (Doble chequeo)
    try {
      await dbInstance.runTransaction(async (transaction) => {
        if (employeeId !== 'VACANTE') {
            // Re-validación atómica de solapamiento
            const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
              .where('employeeId', '==', employeeId)
              .where('endTime', '>', newStart) 
              .limit(10); 

            const snapshot = await transaction.get(overlappingQuery);
            const hasOverlap = snapshot.docs.some(doc => {
                const data = doc.data();
                if (data.status === 'Canceled') return false;
                const existStart = this.convertToDate(data.startTime);
                const existEnd = this.convertToDate(data.endTime);
                return this.overlapService.isOverlap(existStart, existEnd, newStart, newEnd);
            });

            if (hasOverlap) throw new functions.https.HttpsError('already-exists', 'Solapamiento detectado en transacción.');
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
        return finalShift.id; 
      });
      return { id: newShiftRef.id, ...shiftData } as IShift;

    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) throw error;
        const msg = error.message || 'Error desconocido';
        if (msg.includes('LÍMITE') || msg.includes('BLOQUEO') || msg.includes('SOLAPAMIENTO')) {
            throw new functions.https.HttpsError('failed-precondition', msg);
        }
        throw new functions.https.HttpsError('internal', msg);
    }
  }

  // --- EDITAR TURNO (O ASIGNAR VACANTE) ---
  async updateShift(shiftId: string, updateData: Partial<IShift>): Promise<void> {
      const db = this.getDb();
      const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
      
      const currentDoc = await shiftRef.get();
      if (!currentDoc.exists) throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
      const currentShift = currentDoc.data() as IShift;

      const effectiveEmployeeId = updateData.employeeId || currentShift.employeeId;
      const effectiveStart = updateData.startTime ? this.convertToDate(updateData.startTime) : this.convertToDate(currentShift.startTime);
      const effectiveEnd = updateData.endTime ? this.convertToDate(updateData.endTime) : this.convertToDate(currentShift.endTime);

      const isRealEmployee = effectiveEmployeeId !== 'VACANTE';
      const hasChanged = updateData.employeeId !== undefined || updateData.startTime !== undefined || updateData.endTime !== undefined;

      if (isRealEmployee && hasChanged) {
           try {
               await this.workloadService.validateAssignment(effectiveEmployeeId, effectiveStart, effectiveEnd, shiftId);
           } catch (e: any) {
               throw new functions.https.HttpsError('failed-precondition', e.message);
           }
      }

      const safeUpdate = { ...updateData };
      delete (safeUpdate as any).id; 
      
      if (safeUpdate.startTime) safeUpdate.startTime = admin.firestore.Timestamp.fromDate(effectiveStart);
      if (safeUpdate.endTime) safeUpdate.endTime = admin.firestore.Timestamp.fromDate(effectiveEnd);
      
      safeUpdate.updatedAt = admin.firestore.Timestamp.now();
      
      await shiftRef.update(safeUpdate);
  }

  // --- ELIMINAR TURNO ---
  async deleteShift(shiftId: string): Promise<void> {
      const db = this.getDb();
      await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
  }

  // --- REPLICAR ESTRUCTURA (LÓGICA CORREGIDA) ---
  async replicateDailyStructure(
    objectiveId: string, 
    sourceDateStr: string, 
    targetStartDateStr: string, 
    targetEndDateStr: string, 
    schedulerId: string
  ): Promise<{ created: number, skipped: number }> {
    const db = this.getDb();
    
    // Origen: UTC para precisión
    const sourceDate = new Date(sourceDateStr + 'T12:00:00Z');
    const startSource = new Date(sourceDate); startSource.setUTCHours(0,0,0,0);
    const endSource = new Date(sourceDate); endSource.setUTCHours(23,59,59,999);

    const sourceShiftsSnap = await db.collection(SHIFTS_COLLECTION)
        .where('objectiveId', '==', objectiveId)
        .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startSource))
        .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endSource))
        .get();

    if (sourceShiftsSnap.empty) {
        throw new functions.https.HttpsError('not-found', 'El día origen no tiene turnos.');
    }

    const sourceShifts = sourceShiftsSnap.docs.map(doc => doc.data() as IShift);
    
    const batch = db.batch();
    let opCount = 0;
    let skipped = 0;
    const MAX_BATCH_SIZE = 450; 

    const startTarget = new Date(targetStartDateStr + 'T12:00:00Z');
    const endTarget = new Date(targetEndDateStr + 'T12:00:00Z');

    // Bucle día por día
    for (let d = new Date(startTarget); d <= endTarget; d.setDate(d.getDate() + 1)) {
        
        const dayStart = new Date(d); dayStart.setUTCHours(0,0,0,0);
        const dayEnd = new Date(d); dayEnd.setUTCHours(23,59,59,999);
        
        const existingCheck = await db.collection(SHIFTS_COLLECTION)
            .where('objectiveId', '==', objectiveId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(dayStart))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
            .get();

        // 🛑 LÓGICA DE NEGOCIO "COPIAR":
        // 1. Si el día está vacío -> SKIP (No crear estructura de la nada, solo llenar existentes).
        // 2. Si el día tiene turnos REALES (Asignados) -> SKIP (No pisar gente).
        // 3. Si el día tiene SOLO VACANTES -> BORRAR Y REEMPLAZAR (Llenar estructura).

        if (existingCheck.empty) {
            skipped++; // Regla: "no asi donde no las hay"
            continue; 
        }

        const existingShifts = existingCheck.docs.map(doc => ({ ref: doc.ref, data: doc.data() as IShift }));
        const hasRealEmployees = existingShifts.some(s => s.data.employeeId !== 'VACANTE');

        if (hasRealEmployees) {
            skipped++; // Regla: Seguridad (no pisar asignados)
            continue;
        }

        // Si llegamos aquí, solo hay vacantes. Las borramos para reemplazarlas por la copia.
        existingShifts.forEach(s => batch.delete(s.ref));
        opCount += existingShifts.length; // Contamos borrados como operaciones

        // Insertamos la copia del día origen
        for (const template of sourceShifts) {
            const tStart = this.convertToDate(template.startTime);
            const tEnd = this.convertToDate(template.endTime);
            
            const newStart = new Date(d);
            newStart.setUTCHours(tStart.getUTCHours(), tStart.getUTCMinutes(), 0, 0);
            
            const durationMs = tEnd.getTime() - tStart.getTime();
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