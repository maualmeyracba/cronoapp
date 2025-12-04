import { Injectable, ConflictException } from '@nestjs/common';
import * as admin from 'firebase-admin'; // 🛑 CORREGIDO: Importación de módulo
import { WorkloadService } from '../scheduling/workload.service';
import { IAbsence, IAbsencePayload } from '../common/interfaces/absence.interface';

@Injectable()
export class AbsenceService {
    private getDb = () => admin.app().firestore();
    private readonly absencesCollection = this.getDb().collection('absences');
    
    constructor(private readonly workloadService: WorkloadService) {}

    async createAbsence(payload: IAbsencePayload): Promise<IAbsence> {
        const { employeeId, startDate, endDate, clientId } = payload;
        
        // Convertimos los inputs a Timestamps de Firestore para consistencia
        const startTimestamp = startDate as unknown as admin.firestore.Timestamp;
        const endTimestamp = endDate as unknown as admin.firestore.Timestamp;

        // 1. Validar solapamiento (Usa el método recién agregado en WorkloadService)
        // Usamos .toDate() porque WorkloadService trabaja con objetos Date de JS
        const conflictingShifts = await this.workloadService.checkShiftOverlap(
            employeeId,
            startTimestamp.toDate(), 
            endTimestamp.toDate()    
        );

        if (conflictingShifts.length > 0) {
            console.warn(`[AbsenceService] Conflict found for employee ${employeeId}`);
            throw new ConflictException(`Conflict: Employee has ${conflictingShifts.length} shifts assigned during this period.`);
        }

        // 2. Crear el objeto a persistir
        const newAbsence: Omit<IAbsence, 'id'> = {
            employeeId: payload.employeeId,
            employeeName: payload.employeeName,
            clientId: payload.clientId,
            type: payload.type,
            startDate: startTimestamp,
            endDate: endTimestamp,     
            reason: payload.reason,
            status: 'APPROVED', 
            createdAt: admin.firestore.Timestamp.now(), 
        };

        const docRef = await this.absencesCollection.add(newAbsence);
        
        return { id: docRef.id, ...newAbsence } as IAbsence;
    }
}