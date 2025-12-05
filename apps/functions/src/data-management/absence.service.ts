import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { WorkloadService } from '../scheduling/workload.service';
import { IAbsence, IAbsencePayload } from '../common/interfaces/absence.interface';

@Injectable()
export class AbsenceService {
    private getDb = () => admin.app().firestore();
    private readonly absencesCollection = 'ausencias'; 
    private readonly shiftsCollection = 'turnos';
    
    constructor(private readonly workloadService: WorkloadService) {}

    async createAbsence(payload: IAbsencePayload): Promise<IAbsence> {
        // 1. Parsing de fechas (Robustez)
        const parseDate = (input: any): Date => {
            if (typeof input === 'string') return new Date(input);
            if (input && input.seconds) return new Date(input.seconds * 1000);
            return new Date(input);
        };

        const startDateObj = parseDate(payload.startDate);
        const endDateObj = parseDate(payload.endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Fechas inválidas recibidas en el backend.');
        }

        // 2. DETECCIÓN DE CONFLICTOS (Turnos afectados)
        const conflictingShifts = await this.workloadService.checkShiftOverlap(
            payload.employeeId,
            startDateObj, 
            endDateObj    
        );

        const db = this.getDb();
        const batch = db.batch(); // Preparamos un lote de operaciones atómicas

        // 🛑 LÓGICA DE NEGOCIO CORREGIDA:
        // Si hay turnos en el medio, NO bloqueamos. Los cancelamos/liberamos.
        if (conflictingShifts.length > 0) {
            console.log(`[AbsenceService] Se encontraron ${conflictingShifts.length} turnos afectados. Procesando bajas...`);
            
            conflictingShifts.forEach(shift => {
                const shiftRef = db.collection(this.shiftsCollection).doc(shift.id);
                
                // Opción: Cancelamos el turno para que el Admin vea que "se cayó" y deba reasignar
                batch.update(shiftRef, {
                    status: 'Canceled',
                    // Agregamos metadata para auditoría
                    description: `Cancelación automática por Ausencia: ${payload.reason}`,
                    updatedAt: admin.firestore.Timestamp.now()
                });
            });
        }

        // 3. Crear la Ausencia
        const startTimestamp = admin.firestore.Timestamp.fromDate(startDateObj);
        const endTimestamp = admin.firestore.Timestamp.fromDate(endDateObj);

        const newAbsence: any = { 
            employeeId: payload.employeeId,
            employeeName: payload.employeeName,
            clientId: payload.clientId,
            type: payload.type,
            startDate: startTimestamp,
            endDate: endTimestamp,     
            reason: payload.reason,
            status: 'APPROVED', 
            createdAt: admin.firestore.Timestamp.now(), 
            // Guardamos referencia de cuántos turnos impactó
            impactedShiftsCount: conflictingShifts.length 
        };

        // Agregamos la creación de ausencia al lote
        const newAbsenceRef = db.collection(this.absencesCollection).doc();
        batch.set(newAbsenceRef, newAbsence);

        // 4. Ejecutar todo junto (Atomicidad)
        await batch.commit();
        
        return { id: newAbsenceRef.id, ...newAbsence } as IAbsence;
    }
}