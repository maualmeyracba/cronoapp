import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IServicePattern, IPatternPayload } from '../common/interfaces/service-pattern.interface';
import { IShift } from '../common/interfaces/shift.interface';

const PATTERNS_COLLECTION = 'patrones_servicio';
const SHIFTS_COLLECTION = 'turnos';

@Injectable()
export class PatternService {
  
  private getDb = () => admin.app().firestore();

  // --- 1. GESTIÓN DE REGLAS (ABM) ---

  async createPattern(payload: IPatternPayload, userId: string): Promise<IServicePattern> {
    const db = this.getDb();
    const ref = db.collection(PATTERNS_COLLECTION).doc();
    
    const newPattern: IServicePattern = {
        id: ref.id,
        contractId: payload.contractId,
        shiftTypeId: payload.shiftTypeId,
        daysOfWeek: payload.daysOfWeek,
        quantityPerDay: payload.quantity,
        validFrom: admin.firestore.Timestamp.fromDate(new Date(payload.validFrom)),
        validTo: payload.validTo ? admin.firestore.Timestamp.fromDate(new Date(payload.validTo)) : undefined,
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

  // --- 2. EL GENERADOR INTELIGENTE (Motor de Demanda) ---

  /**
   * Genera los "Huecos" (Turnos Vacantes) para un mes específico basándose en los patrones.
   * Esto es lo que llena el calendario de "Gris" listo para asignar.
   */
  async generateVacancies(contractId: string, month: number, year: number): Promise<{ created: number, message: string }> {
    const db = this.getDb();
    
    // A. Obtener patrones activos
    const patterns = await this.getPatternsByContract(contractId);
    if (patterns.length === 0) return { created: 0, message: 'No hay patrones definidos.' };

    // B. Calcular rango del mes
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    // C. Preparar Batch (Escritura masiva eficiente)
    // Nota: Firestore limita batch a 500 ops. En producción, usaríamos chunks.
    const batch = db.batch();
    let count = 0;

    // D. Iterar día por día
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const currentDayOfWeek = d.getDay(); // 0-6
        
        // Para cada patrón configurado...
        for (const pattern of patterns) {
            // Validar vigencia
            const pStart = pattern.validFrom.toDate();
            const pEnd = pattern.validTo?.toDate();
            if (d < pStart || (pEnd && d > pEnd)) continue;

            // Validar día de la semana (¿Toca hoy?)
            if (pattern.daysOfWeek.includes(currentDayOfWeek)) {
                
                // Generar X vacantes según la cantidad requerida
                for (let i = 0; i < pattern.quantityPerDay; i++) {
                    // Aquí necesitaríamos buscar el ShiftType para saber la hora de inicio/fin real
                    // Por simplicidad MVP, asumimos que el pattern tiene la info o la buscamos antes.
                    // (En implementación real, haríamos un getShiftTypesByContract antes del loop)
                    
                    const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
                    
                    // Creamos un "Esqueleto" de turno
                    // 🛑 ESTADO: 'Vacancy' (Nuevo estado que agregaremos a IShift)
                    const vacancy: Partial<IShift> = {
                        id: newShiftRef.id,
                        employeeId: 'VACANTE', // Flag especial o null
                        employeeName: 'VACANTE',
                        objectiveId: '...', // Se debe obtener del contrato
                        objectiveName: '...',
                        // Las horas se calcularían según el ShiftType (ej: 07:00 del día D)
                        startTime: admin.firestore.Timestamp.fromDate(d), // Placeholder
                        endTime: admin.firestore.Timestamp.fromDate(d),   // Placeholder
                        status: 'Assigned', // O un nuevo estado 'Vacancy'
                        role: 'Vigilador', // Del ShiftType
                        schedulerId: 'SYSTEM_GENERATOR',
                        updatedAt: admin.firestore.Timestamp.now()
                    };
                    
                    // batch.set(newShiftRef, vacancy);
                    // count++;
                }
            }
        }
    }

    // await batch.commit();
    return { created: count, message: `Se generaron ${count} vacantes.` };
  }
}