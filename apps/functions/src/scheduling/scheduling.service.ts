import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IShift } from '../common/interfaces/shift.interface'; // RUTA RELATIVA FINAL
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
import * as functions from 'firebase-functions';

const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class SchedulingService {
  
  // Inicialización diferida (Lazy Init)
  private getDb = () => admin.app().firestore();

  constructor(
    private readonly overlapService: ShiftOverlapService,
    private readonly workloadService: WorkloadService
  ) {}

  /**
   * 🛑 FIX CRÍTICO: Función auxiliar para sanear fechas que vienen por la red.
   * Maneja: Firestore Timestamp, Serialized Timestamp ({_seconds}), Strings e ISOs.
   */
  private convertToDate(input: any): Date {
    if (!input) throw new Error('Fecha inválida o inexistente.');
    
    // Caso 1: Es un Timestamp de Firestore real (tiene .toDate)
    if (typeof input.toDate === 'function') {
        return input.toDate();
    }
    // Caso 2: Es un Timestamp serializado (viene del Frontend como JSON)
    if (input._seconds !== undefined) {
        return new Date(input._seconds * 1000);
    }
    // Caso 3: Es un objeto seconds/nanoseconds estándar de Google
    if (input.seconds !== undefined) {
        return new Date(input.seconds * 1000);
    }
    // Caso 4: Es un string ISO o número
    return new Date(input);
  }

  async assignShift(shiftData: Partial<IShift>, userAuth: admin.auth.DecodedIdToken): Promise<IShift> {
    const dbInstance = this.getDb(); 
    const newShiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc();
    
    // 1. Validación de campos requeridos
    if (!shiftData.startTime || !shiftData.endTime || !shiftData.employeeId || !shiftData.objectiveId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos: inicio, fin, empleado u objetivo.');
    }
    
    // 🛑 USAMOS LA NUEVA FUNCIÓN DE CONVERSIÓN AQUÍ
    let newStart: Date;
    let newEnd: Date;

    try {
        newStart = this.convertToDate(shiftData.startTime);
        newEnd = this.convertToDate(shiftData.endTime);
    } catch (e) {
        throw new functions.https.HttpsError('invalid-argument', 'Formato de fecha inválido recibido del cliente.');
    }
    
    const employeeId = shiftData.employeeId!;

    // 2. Validación de coherencia temporal
    if (newStart.getTime() >= newEnd.getTime()) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin.');
    }

    // 3. VALIDACIÓN DE REGLAS DE NEGOCIO (WFM)
    try {
        await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
    } catch (businessRuleError: any) {
        console.warn(`[BUSINESS_RULE_BLOCK] ${businessRuleError.message}`);
        throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
    }

    try {
      await dbInstance.runTransaction(async (transaction) => {
        
        // 4. Verificación de Solapamiento
        const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
          .where('employeeId', '==', employeeId)
          .where('endTime', '>', newStart) 
          .where('startTime', '<', newEnd) 
          .limit(1);

        const snapshot = await transaction.get(overlappingQuery);

        if (!snapshot.empty) {
          const existingShift = snapshot.docs[0].data(); // Data cruda
          // Convertimos también las fechas de la DB por seguridad
          const existingStart = this.convertToDate(existingShift.startTime);
          const existingEnd = this.convertToDate(existingShift.endTime);

          if (this.overlapService.isOverlap(existingStart, existingEnd, newStart, newEnd)) {
             console.error(`[SCHEDULING_ABORTED] Overlap detected for Employee: ${employeeId}.`);
             throw new functions.https.HttpsError('already-exists', 'El empleado ya tiene otro turno asignado en este horario.');
          }
        }
        
        // Escritura del nuevo turno
        const finalShift: IShift = {
          id: newShiftRef.id,
          employeeId: employeeId,
          objectiveId: shiftData.objectiveId!,
          employeeName: shiftData.employeeName || 'NOMBRE_NO_PROVISTO', 
          objectiveName: shiftData.objectiveName || 'OBJETIVO_NO_PROVISTO',
          // Guardamos como Timestamp de Firestore para consistencia en la DB
          startTime: admin.firestore.Timestamp.fromDate(newStart), 
          endTime: admin.firestore.Timestamp.fromDate(newEnd),
          status: 'Assigned',
          schedulerId: userAuth.uid,
          updatedAt: admin.firestore.Timestamp.now(),
        };

        transaction.set(newShiftRef, finalShift);
        return finalShift.id; 
      });

      return { id: newShiftRef.id, ...shiftData } as IShift;

    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        const errorMessage = error.message || 'Error desconocido';

        if (errorMessage.includes('LÍMITE') || errorMessage.includes('BLOQUEO') || errorMessage.includes('ausente')) {
             console.warn(`[BUSINESS_RULE_VIOLATION] ${errorMessage}`);
             throw new functions.https.HttpsError('failed-precondition', errorMessage);
        }
        
        console.error(`[SCHEDULING_TRANSACTION_FAILURE] ${errorMessage}`, error.stack);
        throw new functions.https.HttpsError('internal', `Error en la asignación: ${errorMessage}`);
    }
  }
}