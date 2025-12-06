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
let PatternService = class PatternService {
    constructor() {
        this.getDb = () => admin.app().firestore();
    }
    async createPattern(payload, userId) {
        const db = this.getDb();
        const ref = db.collection(PATTERNS_COLLECTION).doc();
        const newPattern = {
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
    async getPatternsByContract(contractId) {
        const snapshot = await this.getDb().collection(PATTERNS_COLLECTION)
            .where('contractId', '==', contractId)
            .where('active', '==', true)
            .get();
        return snapshot.docs.map(d => d.data());
    }
    async generateVacancies(contractId, month, year) {
        const db = this.getDb();
        const patterns = await this.getPatternsByContract(contractId);
        if (patterns.length === 0)
            return { created: 0, message: 'No hay patrones definidos.' };
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        const batch = db.batch();
        let count = 0;
        for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
            const currentDayOfWeek = d.getDay();
            for (const pattern of patterns) {
                const pStart = pattern.validFrom.toDate();
                const pEnd = pattern.validTo?.toDate();
                if (d < pStart || (pEnd && d > pEnd))
                    continue;
                if (pattern.daysOfWeek.includes(currentDayOfWeek)) {
                    for (let i = 0; i < pattern.quantityPerDay; i++) {
                        const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
                        const vacancy = {
                            id: newShiftRef.id,
                            employeeId: 'VACANTE',
                            employeeName: 'VACANTE',
                            objectiveId: '...',
                            objectiveName: '...',
                            startTime: admin.firestore.Timestamp.fromDate(d),
                            endTime: admin.firestore.Timestamp.fromDate(d),
                            status: 'Assigned',
                            role: 'Vigilador',
                            schedulerId: 'SYSTEM_GENERATOR',
                            updatedAt: admin.firestore.Timestamp.now()
                        };
                    }
                }
            }
        }
        return { created: count, message: `Se generaron ${count} vacantes.` };
    }
};
exports.PatternService = PatternService;
exports.PatternService = PatternService = __decorate([
    (0, common_1.Injectable)()
], PatternService);
//# sourceMappingURL=pattern.service.js.map