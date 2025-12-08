import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IServicePattern, IPatternPayload } from '../common/interfaces/service-pattern.interface';
import { IShiftType } from '../common/interfaces/client.interface';

const PATTERNS_COLLECTION = 'patrones_servicio';
const SHIFTS_COLLECTION = 'turnos';
const SHIFT_TYPES_COLLECTION = 'tipos_turno';

@Injectable()
export class PatternService {
  
  private getDb = () => admin.app().firestore();

  // --- 1. GESTIÓN DE REGLAS (ABM) ---

  async createPattern(payload: IPatternPayload, userId: string): Promise<IServicePattern> {
    const db = this.getDb();
    const ref = db.collection(PATTERNS_COLLECTION).doc();
    
    // Convertimos fechas de string a Timestamp para Firestore
    const validFrom = admin.firestore.Timestamp.fromDate(new Date(payload.validFrom));
    const validTo = payload.validTo ? admin.firestore.Timestamp.fromDate(new Date(payload.validTo)) : undefined;

    const newPattern: IServicePattern = {
        id: ref.id,
        contractId: payload.contractId,
        shiftTypeId: payload.shiftTypeId,
        daysOfWeek: payload.daysOfWeek,
        quantityPerDay: payload.quantity,
        validFrom,
        validTo,
        active: true,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: userId
    };

    await ref.set(newPattern);
    return newPattern;
  }

  async getPatternsByContract(contractId: string): Promise<IServicePattern[]> {
      const snapshot = await this.getDb().collection(PATTERNS_COLLECTION)
        .where('contractId', '==', contractId)
        .where('active', '==', true)
        .get();
      return snapshot.docs.map(d => d.data() as IServicePattern);
  }

  async deletePattern(id: string): Promise<void> {
      await this.getDb().collection(PATTERNS_COLLECTION).doc(id).delete();
  }

  // --- 2. EL GENERADOR (LÓGICA AUTOMÁTICA) ---

  async generateVacancies(contractId: string, month: number, year: number, objectiveId: string): Promise<{ created: number, message: string }> {
    const db = this.getDb();
    
    // A. Buscar reglas (patrones) del contrato
    const patterns = await this.getPatternsByContract(contractId);
    if (patterns.length === 0) return { created: 0, message: 'No hay patrones definidos para este servicio.' };

    // B. Pre-cargar Tipos de Turno (Para saber horarios y duración)
    // Esto evita hacer una consulta por cada día
    const shiftTypesMap = new Map<string, IShiftType>();
    const typesSnapshot = await db.collection(SHIFT_TYPES_COLLECTION).where('contractId', '==', contractId).get();
    
    typesSnapshot.forEach(doc => {
        shiftTypesMap.set(doc.id, { id: doc.id, ...doc.data() } as IShiftType);
    });

    // C. Definir el rango del mes solicitado
    // Nota: month viene 1-12, Date usa 0-11
    const startOfMonth = new Date(year, month - 1, 1); 
    const endOfMonth = new Date(year, month, 0); // El día 0 del siguiente mes es el último de este
    
    const batch = db.batch();
    let count = 0;
    const MAX_BATCH_SIZE = 450; // Firestore limita a 500 ops por batch

    // D. Bucle: Recorrer día por día
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const currentDayOfWeek = d.getDay(); // 0=Dom ... 6=Sab
        
        for (const pattern of patterns) {
            // Validar si el patrón está vigente en esta fecha
            const pStart = pattern.validFrom.toDate();
            // Normalizar a medianoche para comparar solo fechas
            pStart.setHours(0,0,0,0);
            const checkDate = new Date(d);
            checkDate.setHours(0,0,0,0);

            if (checkDate < pStart) continue;
            if (pattern.validTo) {
                const pEnd = pattern.validTo.toDate();
                pEnd.setHours(23,59,59,999);
                if (checkDate > pEnd) continue;
            }

            // Validar si toca trabajar este día de la semana
            if (pattern.daysOfWeek.includes(currentDayOfWeek)) {
                
                const shiftType = shiftTypesMap.get(pattern.shiftTypeId);
                if (!shiftType) continue;

                // Crear N vacantes según la dotación requerida
                for (let i = 0; i < pattern.quantityPerDay; i++) {
                    const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
                    
                    // Calcular Horario Real (Fecha del bucle + Hora del Tipo)
                    // shiftType.startTime es "07:00"
                    const [h, m] = shiftType.startTime.split(':').map(Number);
                    
                    const start = new Date(d);
                    start.setHours(h, m, 0, 0);
                    
                    const end = new Date(start);
                    end.setHours(start.getHours() + shiftType.durationHours);

                    // E. Crear el Objeto Turno (Vacante)
                    const vacancy = {
                        id: newShiftRef.id,
                        employeeId: 'VACANTE', // 🛑 FLAG: Esto le dice al frontend que es gris
                        employeeName: 'VACANTE',
                        objectiveId: objectiveId,
                        objectiveName: 'Sede', // Idealmente buscar nombre real, pero Sede sirve
                        startTime: admin.firestore.Timestamp.fromDate(start),
                        endTime: admin.firestore.Timestamp.fromDate(end),
                        status: 'Assigned', // Estado válido
                        shiftTypeId: shiftType.id,
                        role: shiftType.requiredRole || 'Vigilador',
                        schedulerId: 'SYSTEM_GENERATOR',
                        updatedAt: admin.firestore.Timestamp.now()
                    };

                    batch.set(newShiftRef, vacancy);
                    count++;

                    // Protección simple contra límite de Batch
                    if (count >= MAX_BATCH_SIZE) break; 
                }
            }
        }
        if (count >= MAX_BATCH_SIZE) break;
    }

    if (count > 0) {
        await batch.commit();
    }

    return { 
        created: count, 
        message: count >= MAX_BATCH_SIZE 
            ? `Límite de lote alcanzado. Se generaron ${count} vacantes.` 
            : `¡Éxito! Se generaron ${count} turnos vacantes.` 
    };
  }
}