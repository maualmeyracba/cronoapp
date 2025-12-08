"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const shift_overlap_service_1 = require("./shift-overlap.service");
const workload_service_1 = require("./workload.service");
const functions = require("firebase-functions");
const SHIFTS_COLLECTION = 'turnos';
let SchedulingService = class SchedulingService {
    constructor(overlapService, workloadService) {
        this.overlapService = overlapService;
        this.workloadService = workloadService;
        this.getDb = () => admin.app().firestore();
    }
    convertToDate(input) {
        if (!input)
            throw new Error('Fecha inválida.');
        if (typeof input.toDate === 'function')
            return input.toDate();
        if (input._seconds !== undefined)
            return new Date(input._seconds * 1000);
        if (input.seconds !== undefined)
            return new Date(input.seconds * 1000);
        return new Date(input);
    }
    async assignShift(shiftData, userAuth) {
        const dbInstance = this.getDb();
        const newShiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc();
        if (!shiftData.startTime || !shiftData.endTime || !shiftData.employeeId || !shiftData.objectiveId) {
            throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos.');
        }
        let newStart;
        let newEnd;
        try {
            newStart = this.convertToDate(shiftData.startTime);
            newEnd = this.convertToDate(shiftData.endTime);
        }
        catch (e) {
            throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
        }
        const employeeId = shiftData.employeeId;
        if (newStart.getTime() >= newEnd.getTime())
            throw new common_1.BadRequestException('Horario inválido.');
        try {
            await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
        }
        catch (businessRuleError) {
            console.warn(`[BUSINESS_RULE] ${businessRuleError.message}`);
            if (employeeId !== 'VACANTE') {
                throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
            }
        }
        const finalShift = {
            id: newShiftRef.id,
            employeeId,
            objectiveId: shiftData.objectiveId,
            employeeName: shiftData.employeeName || 'S/D',
            objectiveName: shiftData.objectiveName || 'S/D',
            startTime: admin.firestore.Timestamp.fromDate(newStart),
            endTime: admin.firestore.Timestamp.fromDate(newEnd),
            status: 'Assigned',
            schedulerId: userAuth.uid,
            updatedAt: admin.firestore.Timestamp.now(),
            role: shiftData.role || 'Vigilador'
        };
        await newShiftRef.set(finalShift);
        return finalShift;
    }
    async updateShift(shiftId, updateData) {
        const db = this.getDb();
        const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
        const safeUpdate = { ...updateData };
        delete safeUpdate.id;
        delete safeUpdate.employeeId;
        if (safeUpdate.startTime)
            safeUpdate.startTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.startTime));
        if (safeUpdate.endTime)
            safeUpdate.endTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.endTime));
        safeUpdate.updatedAt = admin.firestore.Timestamp.now();
        await shiftRef.update(safeUpdate);
    }
    async deleteShift(shiftId) {
        const db = this.getDb();
        await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
    }
    async replicateDailyStructure(objectiveId, sourceDateStr, targetStartDateStr, targetEndDateStr, schedulerId) {
        const db = this.getDb();
        const sourceDate = new Date(sourceDateStr + 'T12:00:00');
        const startSource = new Date(sourceDate);
        startSource.setHours(0, 0, 0, 0);
        const endSource = new Date(sourceDate);
        endSource.setHours(23, 59, 59, 999);
        const sourceShiftsSnap = await db.collection(SHIFTS_COLLECTION)
            .where('objectiveId', '==', objectiveId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startSource))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endSource))
            .get();
        if (sourceShiftsSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'No hay turnos en el día origen para copiar.');
        }
        const sourceShifts = sourceShiftsSnap.docs.map(doc => doc.data());
        const batch = db.batch();
        let opCount = 0;
        let skipped = 0;
        const MAX_BATCH_SIZE = 450;
        const startTarget = new Date(targetStartDateStr + 'T12:00:00');
        const endTarget = new Date(targetEndDateStr + 'T12:00:00');
        for (let d = new Date(startTarget); d <= endTarget; d.setDate(d.getDate() + 1)) {
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            const existingCheck = await db.collection(SHIFTS_COLLECTION)
                .where('objectiveId', '==', objectiveId)
                .where('startTime', '>=', admin.firestore.Timestamp.fromDate(dayStart))
                .where('startTime', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
                .limit(1)
                .get();
            if (!existingCheck.empty) {
                skipped++;
                continue;
            }
            for (const template of sourceShifts) {
                const tStart = this.convertToDate(template.startTime);
                const tEnd = this.convertToDate(template.endTime);
                const newStart = new Date(d);
                newStart.setHours(tStart.getHours(), tStart.getMinutes(), 0, 0);
                const durationMs = tEnd.getTime() - tStart.getTime();
                const newEnd = new Date(newStart.getTime() + durationMs);
                const newShiftRef = db.collection(SHIFTS_COLLECTION).doc();
                const newShift = {
                    id: newShiftRef.id,
                    objectiveId: objectiveId,
                    objectiveName: template.objectiveName,
                    employeeId: template.employeeId,
                    employeeName: template.employeeName,
                    role: template.role || 'Vigilador',
                    startTime: admin.firestore.Timestamp.fromDate(newStart),
                    endTime: admin.firestore.Timestamp.fromDate(newEnd),
                    status: 'Assigned',
                    schedulerId: schedulerId,
                    updatedAt: admin.firestore.Timestamp.now(),
                    checkInTime: undefined,
                    checkOutTime: undefined
                };
                batch.set(newShiftRef, newShift);
                opCount++;
                if (opCount >= MAX_BATCH_SIZE)
                    break;
            }
            if (opCount >= MAX_BATCH_SIZE)
                break;
        }
        if (opCount > 0)
            await batch.commit();
        return { created: opCount, skipped };
    }
};
exports.SchedulingService = SchedulingService;
exports.SchedulingService = SchedulingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shift_overlap_service_1.ShiftOverlapService,
        workload_service_1.WorkloadService])
], SchedulingService);
//# sourceMappingURL=scheduling.service.js.map