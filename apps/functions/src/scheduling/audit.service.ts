import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { GeofencingService } from './geofencing.service';
import { DataManagementService } from '../data-management/data-management.service'; 
import { IShift } from '../common/interfaces/shift.interface'; // RUTA RELATIVA FINAL
import * as functions from 'firebase-functions';
import { IObjective } from '../common/interfaces/client.interface'; 

const SHIFTS_COLLECTION = 'turnos';
// 🛑 ELIMINADO: const db = admin.firestore(); // <--- ESTO CAUSABA EL ERROR

@Injectable()
export class AuditService {
  
  constructor(
    private readonly geofencingService: GeofencingService,
    private readonly dmService: DataManagementService,
  ) {}

  // 🔑 FIX: Getter privado para Inicialización Diferida (Lazy Init)
  private getDb = () => admin.app().firestore();

  async auditShiftAction(
    shiftId: string,
    action: 'CHECK_IN' | 'CHECK_OUT',
    employeeCoords: { latitude: number, longitude: number },
    employeeUid: string,
  ): Promise<IShift> {
    
    const dbInstance = this.getDb(); // 🛑 Usar la instancia diferida
    const shiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc(shiftId);
    
    return dbInstance.runTransaction(async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);

      if (!shiftDoc.exists) {
        throw new BadRequestException('Shift not found.');
      }

      const shift = shiftDoc.data() as IShift;
      
      // Regla 1: Autorización de Propiedad
      if (shift.employeeId !== employeeUid) {
        throw new ForbiddenException('No estás autorizado para modificar este turno.');
      }
      
      // Regla 2: Obtener Coordenadas del Objetivo
      const objective = await this.dmService.getObjectiveById(shift.objectiveId) as IObjective; 
      
      // Regla 3: Verificación de Geofence (P4)
      const objectiveCoords = objective.location;
      if (!this.geofencingService.isInGeofence(employeeCoords, objectiveCoords)) {
        console.warn(`Geofence failed for ${employeeUid} at shift ${shiftId}.`);
        throw new functions.https.HttpsError('failed-precondition', 'Debe estar cerca del objetivo para registrar la acción.');
      }
      
      // Regla 4: Lógica de Estado y Actualización
      const now = admin.firestore.Timestamp.now();
      let newStatus: IShift['status'];

      if (action === 'CHECK_IN' && shift.status === 'Assigned') {
        newStatus = 'InProgress';
        shift.checkInTime = now;
      } else if (action === 'CHECK_OUT' && shift.status === 'InProgress') {
        newStatus = 'Completed';
        shift.checkOutTime = now;
      } else {
        throw new BadRequestException(`Acción ${action} inválida para el estado actual: ${shift.status}.`);
      }
      
      // Actualización Atómica
      shift.status = newStatus;
      shift.updatedAt = now;
      transaction.update(shiftRef, shift as Partial<IShift>);

      return shift;
    });
  }
}