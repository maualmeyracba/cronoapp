import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { GeofencingService } from './geofencing.service';
import { DataManagementService } from '../data-management/data-management.service'; 
import { IShift } from '../common/interfaces/shift.interface';
import * as functions from 'firebase-functions';
import { IObjective } from '../common/interfaces/client.interface'; 

const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class AuditService {
  
  constructor(
    private readonly geofencingService: GeofencingService,
    private readonly dmService: DataManagementService,
  ) {}

  // Inicialización diferida de Firestore
  private getDb = () => admin.app().firestore();

  async auditShiftAction(
    shiftId: string,
    action: 'CHECK_IN' | 'CHECK_OUT',
    employeeCoords: { latitude: number, longitude: number },
    employeeUid: string,
  ): Promise<IShift> {
    
    const dbInstance = this.getDb();
    const shiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc(shiftId);

    return dbInstance.runTransaction(async (transaction) => {
      // 1. Obtener el Turno
      const shiftDoc = await transaction.get(shiftRef);

      if (!shiftDoc.exists) {
        throw new BadRequestException('El turno no existe.');
      }

      const shift = shiftDoc.data() as IShift;
      
      // 🛑 REGLA 1: Autorización de Propiedad
      if (shift.employeeId !== employeeUid) {
        throw new ForbiddenException('No estás autorizado para gestionar este turno.');
      }
      
      // 🛑 REGLA 2: Validación Temporal (Anti-Anticipación)
      // Esta validación va ANTES del Geofence para dar feedback más útil.
      const now = admin.firestore.Timestamp.now();
      
      if (action === 'CHECK_IN') {
          const shiftStartMillis = shift.startTime.toMillis();
          const nowMillis = now.toMillis();
          
          // Diferencia en milisegundos (Positivo = Futuro, Negativo = Pasado/Tarde)
          const diffMillis = shiftStartMillis - nowMillis;
          const diffMinutes = diffMillis / (1000 * 60);
          
          // Tolerancia: Solo se permite fichar 10 minutos antes del inicio
          const TOLERANCE_MINUTES = 10; 
          
          // Si faltan más de 10 minutos, bloqueamos.
          if (diffMinutes > TOLERANCE_MINUTES) {
              throw new functions.https.HttpsError(
                  'failed-precondition', 
                  `⏳ Es muy temprano. El fichaje se habilita ${TOLERANCE_MINUTES} minutos antes del inicio del turno.`
              );
          }
      }

      // 🛑 REGLA 3: Verificación de Geofence (Ubicación)
      // Obtenemos el objetivo para saber sus coordenadas
      const objective = await this.dmService.getObjectiveById(shift.objectiveId) as IObjective; 
      const objectiveCoords = objective.location;

      if (!this.geofencingService.isInGeofence(employeeCoords, objectiveCoords)) {
        console.warn(`[GEOFENCE_FAIL] Employee ${employeeUid} outside range for Shift ${shiftId}.`);
        throw new functions.https.HttpsError(
            'failed-precondition', 
            '📍 Estás demasiado lejos del objetivo. Acércate a la sede para fichar.'
        );
      }
      
      // 🛑 REGLA 4: Transición de Estado
      let newStatus: IShift['status'];

      if (action === 'CHECK_IN') {
          if (shift.status !== 'Assigned') {
              throw new BadRequestException(`No se puede dar presente. El estado actual es: ${shift.status}`);
          }
          newStatus = 'InProgress';
          shift.checkInTime = now;
      } else if (action === 'CHECK_OUT') {
          if (shift.status !== 'InProgress') {
              throw new BadRequestException(`No se puede finalizar. El turno no está en curso (Estado: ${shift.status})`);
          }
          newStatus = 'Completed';
          shift.checkOutTime = now;
      } else {
          throw new BadRequestException(`Acción desconocida: ${action}`);
      }
      
      // Actualización Atómica en Base de Datos
      shift.status = newStatus;
      shift.updatedAt = now;
      
      // Solo actualizamos los campos que cambiaron para eficiencia
      transaction.update(shiftRef, {
          status: newStatus,
          checkInTime: shift.checkInTime,
          checkOutTime: shift.checkOutTime,
          updatedAt: now
      });

      return shift;
    });
  }
}