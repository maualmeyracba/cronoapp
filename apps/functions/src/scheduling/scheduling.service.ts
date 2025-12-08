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

  // ... (Mantenemos assignShift, updateShift, deleteShift iguales que antes) ...

  async assignShift(shiftData: Partial<IShift>, userAuth: admin.auth.DecodedIdToken): Promise<IShift> {
     // ... (Código existente de assignShift - sin cambios, asegurate de mantenerlo) ...
     // Para brevedad, asumo que este método ya lo tienes funcional del código anterior.
     // Si lo necesitas completo nuevamente, pídemelo.
     // Aquí abajo agrego la NUEVA funcionalidad crítica:
     
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
 
     try {
         // Validaciones de negocio (Workload)
         await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
     } catch (businessRuleError: any) {
         console.warn(`[BUSINESS_RULE] ${businessRuleError.message}`);
         // Permitimos "VACANTE" sin validación de carga laboral
         if (employeeId !== 'VACANTE') {
             throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
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

      await newShiftRef.set(finalShift);
      return finalShift;
  }
  
  async updateShift(shiftId: string, updateData: Partial<IShift>): Promise<void> {
      const db = this.getDb();
      const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
      const safeUpdate = { ...updateData };
      delete (safeUpdate as any).id; 
      delete (safeUpdate as any).employeeId;
      if (safeUpdate.startTime) safeUpdate.startTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.startTime));
      if (safeUpdate.endTime) safeUpdate.endTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.endTime));
      safeUpdate.updatedAt = admin.firestore.Timestamp.now();
      await shiftRef.update(safeUpdate);
  }

  async deleteShift(shiftId: string): Promise<void> {
      const db = this.getDb();
      await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
  }

  /**
   * 🛑 NUEVA FUNCIÓN: REPLICACIÓN MASIVA INTELIGENTE
   * Copia la estructura de un día a un rango de fechas.
   */
  async replicateDailyStructure(
    objectiveId: string, 
    sourceDateStr: string, 
    targetStartDateStr: string, 
    targetEndDateStr: string, 
    schedulerId: string
  ): Promise<{ created: number, skipped: number }> {
    const db = this.getDb();

    // 1. Definir rango del día fuente (00:00 a 23:59)
    // Se usa string YYYY-MM-DD para evitar problemas de timezone en servidor
    const sourceDate = new Date(sourceDateStr + 'T12:00:00'); // Mediodía para asegurar el día correcto
    const startSource = new Date(sourceDate); startSource.setHours(0,0,0,0);
    const endSource = new Date(sourceDate); endSource.setHours(23,59,59,999);

    // 2. Obtener turnos modelo
    const sourceShiftsSnap = await db.collection(SHIFTS_COLLECTION)
        .where('objectiveId', '==', objectiveId)
        .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startSource))
        .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endSource))
        .get();

    if (sourceShiftsSnap.empty) {
        throw new functions.https.HttpsError('not-found', 'No hay turnos en el día origen para copiar.');
    }

    const sourceShifts = sourceShiftsSnap.docs.map(doc => doc.data() as IShift);
    
    // 3. Preparar Batch (Lotes de escritura)
    const batch = db.batch();
    let opCount = 0;
    let skipped = 0;
    const MAX_BATCH_SIZE = 450; 

    // Fechas destino
    const startTarget = new Date(targetStartDateStr + 'T12:00:00');
    const endTarget = new Date(targetEndDateStr + 'T12:00:00');

    // 4. Bucle: Día por día en el destino
    // Clonamos la fecha inicio para iterar
    for (let d = new Date(startTarget); d <= endTarget; d.setDate(d.getDate() + 1)) {
        
        // A. Seguridad: Verificar si el día destino YA TIENE turnos
        const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
        
        const existingCheck = await db.collection(SHIFTS_COLLECTION)
            .where('objectiveId', '==', objectiveId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(dayStart))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
            .limit(1)
            .get();

        if (!existingCheck.empty) {
            skipped++;
            continue; // 🛑 EVITAR SOLAPAMIENTO: Saltamos días ya planificados
        }

        // B. Crear copias de los turnos
        for (const template of sourceShifts) {
            // Fechas originales
            const tStart = this.convertToDate(template.startTime);
            const tEnd = this.convertToDate(template.endTime);
            
            // Calcular nueva fecha de Inicio (Mismo horario HH:mm, nueva fecha YYYY-MM-DD)
            const newStart = new Date(d);
            newStart.setHours(tStart.getHours(), tStart.getMinutes(), 0, 0);
            
            // Calcular nueva fecha de Fin (Basada en la duración original)
            const durationMs = tEnd.getTime() - tStart.getTime();
            const newEnd = new Date(newStart.getTime() + durationMs);

            const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
            
            const newShift: IShift = {
                id: newShiftRef.id,
                objectiveId: objectiveId,
                objectiveName: template.objectiveName,
                // Copiamos el empleado asignado. Si quisieras solo copiar "huecos", pondrías 'VACANTE' aquí.
                employeeId: template.employeeId, 
                employeeName: template.employeeName,
                role: template.role || 'Vigilador',
                
                startTime: admin.firestore.Timestamp.fromDate(newStart),
                endTime: admin.firestore.Timestamp.fromDate(newEnd),
                
                status: 'Assigned', // Estado inicial
                schedulerId: schedulerId,
                updatedAt: admin.firestore.Timestamp.now(),
                
                // Limpiamos datos operativos de la copia
                checkInTime: undefined,
                checkOutTime: undefined
            };

            batch.set(newShiftRef, newShift);
            opCount++;
            
            if (opCount >= MAX_BATCH_SIZE) break; // Protección Firestore
        }
        if (opCount >= MAX_BATCH_SIZE) break;
    }

    if (opCount > 0) await batch.commit();

    return { created: opCount, skipped };
  }
}