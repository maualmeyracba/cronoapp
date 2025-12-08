"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const PATTERNS_COLLECTION = 'patrones_servicio';
const SHIFTS_COLLECTION = 'turnos';
const SHIFT_TYPES_COLLECTION = 'tipos_turno';
let PatternService = class PatternService {
    constructor() {
        this.getDb = () => admin.app().firestore();
    }
    async createPattern(payload, userId) {
        const db = this.getDb();
        const ref = db.collection(PATTERNS_COLLECTION).doc();
        const validFrom = admin.firestore.Timestamp.fromDate(new Date(payload.validFrom));
        const validTo = payload.validTo ? admin.firestore.Timestamp.fromDate(new Date(payload.validTo)) : undefined;
        const newPattern = {
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
    async getPatternsByContract(contractId) {
        const snapshot = await this.getDb().collection(PATTERNS_COLLECTION)
            .where('contractId', '==', contractId)
            .where('active', '==', true)
            .get();
        return snapshot.docs.map(d => d.data());
    }
    async deletePattern(id) {
        await this.getDb().collection(PATTERNS_COLLECTION).doc(id).delete();
    }
    async generateVacancies(contractId, month, year, objectiveId) {
        const db = this.getDb();
        const patterns = await this.getPatternsByContract(contractId);
        if (patterns.length === 0)
            return { created: 0, message: 'No hay patrones definidos para este servicio.' };
        const shiftTypesMap = new Map();
        const typesSnapshot = await db.collection(SHIFT_TYPES_COLLECTION).where('contractId', '==', contractId).get();
        typesSnapshot.forEach(doc => {
            shiftTypesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        const batch = db.batch();
        let count = 0;
        const MAX_BATCH_SIZE = 450;
        for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
            const currentDayOfWeek = d.getDay();
            for (const pattern of patterns) {
                const pStart = pattern.validFrom.toDate();
                pStart.setHours(0, 0, 0, 0);
                const checkDate = new Date(d);
                checkDate.setHours(0, 0, 0, 0);
                if (checkDate < pStart)
                    continue;
                if (pattern.validTo) {
                    const pEnd = pattern.validTo.toDate();
                    pEnd.setHours(23, 59, 59, 999);
                    if (checkDate > pEnd)
                        continue;
                }
                if (pattern.daysOfWeek.includes(currentDayOfWeek)) {
                    const shiftType = shiftTypesMap.get(pattern.shiftTypeId);
                    if (!shiftType)
                        continue;
                    for (let i = 0; i < pattern.quantityPerDay; i++) {
                        const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
                        const [h, m] = shiftType.startTime.split(':').map(Number);
                        const start = new Date(d);
                        start.setHours(h, m, 0, 0);
                        const end = new Date(start);
                        end.setHours(start.getHours() + shiftType.durationHours);
                        const vacancy = {
                            id: newShiftRef.id,
                            employeeId: 'VACANTE',
                            employeeName: 'VACANTE',
                            objectiveId: objectiveId,
                            objectiveName: 'Sede',
                            startTime: admin.firestore.Timestamp.fromDate(start),
                            endTime: admin.firestore.Timestamp.fromDate(end),
                            status: 'Assigned',
                            shiftTypeId: shiftType.id,
                            role: shiftType.requiredRole || 'Vigilador',
                            schedulerId: 'SYSTEM_GENERATOR',
                            updatedAt: admin.firestore.Timestamp.now()
                        };
                        batch.set(newShiftRef, vacancy);
                        count++;
                        if (count >= MAX_BATCH_SIZE)
                            break;
                    }
                }
            }
            if (count >= MAX_BATCH_SIZE)
                break;
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
};
exports.PatternService = PatternService;
exports.PatternService = PatternService = __decorate([
    (0, common_1.Injectable)()
], PatternService);
//# sourceMappingURL=pattern.service.js.map