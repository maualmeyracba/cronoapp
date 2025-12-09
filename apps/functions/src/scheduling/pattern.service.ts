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

  // --- 1. GESTIÓN DE REGLAS (UPSERT) ---

  async createPattern(payload: IPatternPayload, userId: string): Promise<IServicePattern> {
    const db = this.getDb();
    
    // Validamos si ya existe
    const existingSnap = await db.collection(PATTERNS_COLLECTION)
        .where('contractId', '==', payload.contractId)
        .where('shiftTypeId', '==', payload.shiftTypeId)
        .where('active', '==', true)
        .limit(1)
        .get();

    const validFrom = admin.firestore.Timestamp.fromDate(new Date(payload.validFrom));
    const validTo = payload.validTo ? admin.firestore.Timestamp.fromDate(new Date(payload.validTo)) : null;

    const patternData = {
        contractId: payload.contractId,
        shiftTypeId: payload.shiftTypeId,
        daysOfWeek: payload.daysOfWeek,
        quantityPerDay: payload.quantity,
        validFrom,
        validTo,
        active: true,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: userId
    };

    if (!existingSnap.empty) {
        const docId = existingSnap.docs[0].id;
        await db.collection(PATTERNS_COLLECTION).doc(docId).update(patternData);
        return { id: docId, ...patternData } as unknown as IServicePattern;
    } else {
        const ref = db.collection(PATTERNS_COLLECTION).doc();
        const newPattern = {
            ...patternData,
            id: ref.id,
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: userId
        };
        await ref.set(newPattern);
        return newPattern as any;
    }
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

  // --- 2. EL GENERADOR (CORREGIDO HUSO HORARIO) ---

  async generateVacancies(contractId: string, month: number, year: number, objectiveId: string): Promise<{ created: number, message: string }> {
    const db = this.getDb();
    const patterns = await this.getPatternsByContract(contractId);
    if (patterns.length === 0) return { created: 0, message: 'No hay patrones definidos. Usa "+ Regla Base".' };

    const shiftTypesMap = new Map<string, IShiftType>();
    const typesSnapshot = await db.collection(SHIFT_TYPES_COLLECTION).where('contractId', '==', contractId).get();
    typesSnapshot.forEach(doc => shiftTypesMap.set(doc.id, { id: doc.id, ...doc.data() } as IShiftType));

    // Definimos rango del mes. Usamos UTC puro para iterar días sin problemas de cambio de hora.
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)); 
    
    const batch = db.batch();
    let count = 0;
    const MAX_BATCH_SIZE = 450; 

    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const currentDayOfWeek = d.getUTCDay();
        const dateStr = d.toISOString().split('T')[0]; // "2025-12-09"

        for (const pattern of patterns) {
            const pStart = pattern.validFrom.toDate().toISOString().split('T')[0];
            if (dateStr < pStart) continue;
            
            if (pattern.validTo) {
                const pEnd = pattern.validTo.toDate().toISOString().split('T')[0];
                if (dateStr > pEnd) continue;
            }

            if (pattern.daysOfWeek.includes(currentDayOfWeek)) {
                const shiftType = shiftTypesMap.get(pattern.shiftTypeId);
                if (!shiftType) continue;

                for (let i = 0; i < pattern.quantityPerDay; i++) {
                    const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();

                    // 🛑 FIX ZONA HORARIA: ARGENTINA (GMT-3)
                    // En lugar de 'Z' (UTC), usamos '-03:00'.
                    // Esto le dice a Firestore: "Esta hora es local de Argentina, guárdala como tal".
                    const startISO = `${dateStr}T${shiftType.startTime}:00-03:00`;
                    const startObj = new Date(startISO);
                    
                    // Calculamos fin sumando horas a la fecha ya parseada
                    const endObj = new Date(startObj.getTime() + (shiftType.durationHours * 60 * 60 * 1000));

                    const vacancy = {
                        id: newShiftRef.id,
                        employeeId: 'VACANTE', 
                        employeeName: 'VACANTE',
                        objectiveId: objectiveId,
                        objectiveName: 'Sede', // Idealmente buscar nombre real del objetivo
                        startTime: admin.firestore.Timestamp.fromDate(startObj),
                        endTime: admin.firestore.Timestamp.fromDate(endObj),
                        status: 'Assigned', 
                        shiftTypeId: shiftType.id,
                        role: shiftType.requiredRole || 'Vigilador',
                        schedulerId: 'SYSTEM_GENERATOR',
                        updatedAt: admin.firestore.Timestamp.now()
                    };
                    
                    batch.set(newShiftRef, vacancy);
                    count++;
                    if (count >= MAX_BATCH_SIZE) break;
                }
            }
        }
        if (count >= MAX_BATCH_SIZE) break;
    }

    if (count > 0) await batch.commit();
    return { 
        created: count, 
        message: count >= MAX_BATCH_SIZE ? `Límite de lote. ${count} vacantes.` : `¡Éxito! ${count} vacantes generadas.` 
    };
  }

  // --- 3. LIMPIEZA DE ESTRUCTURA ---
  async clearVacancies(objectiveId: string, month: number, year: number): Promise<{ deleted: number }> {
      const db = this.getDb();
      // Rango amplio para cubrir todo el mes en cualquier TZ
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      
      const snapshot = await db.collection(SHIFTS_COLLECTION)
          .where('objectiveId', '==', objectiveId)
          .where('employeeId', '==', 'VACANTE')
          .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfMonth))
          .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfMonth))
          .get();

      if (snapshot.empty) return { deleted: 0 };

      const batch = db.batch();
      let count = 0;
      snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          count++;
      });
      await batch.commit();
      return { deleted: count };
  }
}