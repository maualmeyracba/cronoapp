import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
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
    if (!input) throw new Error('Fecha inválida o inexistente.');
    if (typeof input.toDate === 'function') return input.toDate();
    if (input._seconds !== undefined) return new Date(input._seconds * 1000);
    if (input.seconds !== undefined) return new Date(input.seconds * 1000);
    return new Date(input);
  }

  async assignShift(shiftData: Partial<IShift>, userAuth: admin.auth.DecodedIdToken): Promise<IShift> {
    const dbInstance = this.getDb(); 
    const newShiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc();

    if (!shiftData.startTime || !shiftData.endTime || !shiftData.employeeId || !shiftData.objectiveId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos: inicio, fin, empleado u objetivo.');
    }
    
    let newStart: Date;
    let newEnd: Date;

    try {
        newStart = this.convertToDate(shiftData.startTime);
        newEnd = this.convertToDate(shiftData.endTime);
    } catch (e) {
        throw new functions.https.HttpsError('invalid-argument', 'Formato de fecha inválido recibido del cliente.');
    }
    
    const employeeId = shiftData.employeeId!;

    if (newStart.getTime() >= newEnd.getTime()) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin.');
    }

    try {
        await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
    } catch (businessRuleError: any) {
        console.warn(`[BUSINESS_RULE_BLOCK] ${businessRuleError.message}`);
        throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
    }

    try {
      await dbInstance.runTransaction(async (transaction) => {
        
        const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
          .where('employeeId', '==', employeeId)
          .where('endTime', '>', newStart) 
          .limit(10); 

        const snapshot = await transaction.get(overlappingQuery);
        
        const hasOverlap = snapshot.docs.some(doc => {
            const data = doc.data();
            const existStart = this.convertToDate(data.startTime);
            const existEnd = this.convertToDate(data.endTime);
            return this.overlapService.isOverlap(existStart, existEnd, newStart, newEnd);
        });

        if (hasOverlap) {
             console.error(`[SCHEDULING_ABORTED] Overlap detected for Employee: ${employeeId}.`);
             throw new functions.https.HttpsError('already-exists', 'El empleado ya tiene otro turno asignado en este horario.');
        }
        
        const finalShift: IShift = {
          id: newShiftRef.id,
          employeeId: employeeId,
          objectiveId: shiftData.objectiveId!,
          employeeName: shiftData.employeeName || 'NOMBRE_NO_PROVISTO', 
          objectiveName: shiftData.objectiveName || 'OBJETIVO_NO_PROVISTO',
          startTime: admin.firestore.Timestamp.fromDate(newStart), 
          endTime: admin.firestore.Timestamp.fromDate(newEnd),
          status: 'Assigned',
          schedulerId: userAuth.uid,
          updatedAt: admin.firestore.Timestamp.now(),
          // 🛑 FIX: Ya no da error porque IShift incluye 'role'
          role: shiftData.role || 'Vigilador' 
        };

        transaction.set(newShiftRef, finalShift);
        return finalShift.id; 
      });

      return { id: newShiftRef.id, ...shiftData } as IShift;

    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) { throw error; }

        const errorMessage = error.message || 'Error desconocido';
        if (errorMessage.includes('LÍMITE') || errorMessage.includes('BLOQUEO') || errorMessage.includes('ausente')) {
             throw new functions.https.HttpsError('failed-precondition', errorMessage);
        }
        
        console.error(`[SCHEDULING_TRANSACTION_FAILURE] ${errorMessage}`, error.stack);
        throw new functions.https.HttpsError('internal', `Error en la asignación: ${errorMessage}`);
    }
  }

  async updateShift(shiftId: string, updateData: Partial<IShift>): Promise<void> {
      const db = this.getDb();
      const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);

      const safeUpdate = { ...updateData };
      delete (safeUpdate as any).id; 
      delete (safeUpdate as any).employeeId; 
      
      if (safeUpdate.startTime) {
          safeUpdate.startTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.startTime));
      }
      if (safeUpdate.endTime) {
          safeUpdate.endTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.endTime));
      }

      safeUpdate.updatedAt = admin.firestore.Timestamp.now();
      await shiftRef.update(safeUpdate);
  }

  async deleteShift(shiftId: string): Promise<void> {
      const db = this.getDb();
      await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
  }
}