import { Injectable, ConflictException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { WorkloadService } from '../scheduling/workload.service';
import { IAbsence, IAbsencePayload } from '../common/interfaces/absence.interface';

@Injectable()
export class AbsenceService {
    // Inicialización diferida
    private getDb = () => admin.app().firestore();
    private readonly absencesCollection = 'ausencias'; 
    
    constructor(private readonly workloadService: WorkloadService) {}

    async createAbsence(payload: IAbsencePayload): Promise<IAbsence> {
        // 1. Convertimos fechas
        const startDateObj = (payload.startDate as any).toDate ? (payload.startDate as any).toDate() : new Date(payload.startDate as any);
        const endDateObj = (payload.endDate as any).toDate ? (payload.endDate as any).toDate() : new Date(payload.endDate as any);

        // 2. Validar solapamiento
        const conflictingShifts = await this.workloadService.checkShiftOverlap(
            payload.employeeId,
            startDateObj, 
            endDateObj    
        );

        if (conflictingShifts.length > 0) {
            console.warn(`[AbsenceService] Conflict found for employee ${payload.employeeId}`);
            throw new ConflictException(`Conflicto: El empleado tiene ${conflictingShifts.length} turnos asignados durante este período.`);
        }

        // 3. Crear el objeto a persistir
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
        };

        const docRef = await this.getDb().collection(this.absencesCollection).add(newAbsence);
        
        return { id: docRef.id, ...newAbsence } as IAbsence;
    }
}