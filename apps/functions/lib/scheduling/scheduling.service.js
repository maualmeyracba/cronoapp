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
            throw new Error('Fecha inválida o inexistente.');
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
            throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos: inicio, fin, empleado u objetivo.');
        }
        let newStart;
        let newEnd;
        try {
            newStart = this.convertToDate(shiftData.startTime);
            newEnd = this.convertToDate(shiftData.endTime);
        }
        catch (e) {
            throw new functions.https.HttpsError('invalid-argument', 'Formato de fecha inválido recibido del cliente.');
        }
        const employeeId = shiftData.employeeId;
        if (newStart.getTime() >= newEnd.getTime()) {
            throw new common_1.BadRequestException('La hora de inicio debe ser anterior a la hora de fin.');
        }
        try {
            await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
        }
        catch (businessRuleError) {
            console.warn(`[BUSINESS_RULE_BLOCK] ${businessRuleError.message}`);
            throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
        }
        try {
            await dbInstance.runTransaction(async (transaction) => {
                const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
                    .where('employeeId', '==', employeeId)
                    .where('endTime', '>', newStart)
                    .limit(10);
                const snapshot = await transaction.get(overlappingQuery);
                const hasOverlap = snapshot.docs.some(doc => {
                    const data = doc.data();
                    const existStart = this.convertToDate(data.startTime);
                    const existEnd = this.convertToDate(data.endTime);
                    return this.overlapService.isOverlap(existStart, existEnd, newStart, newEnd);
                });
                if (hasOverlap) {
                    console.error(`[SCHEDULING_ABORTED] Overlap detected for Employee: ${employeeId}.`);
                    throw new functions.https.HttpsError('already-exists', 'El empleado ya tiene otro turno asignado en este horario.');
                }
                const finalShift = {
                    id: newShiftRef.id,
                    employeeId: employeeId,
                    objectiveId: shiftData.objectiveId,
                    employeeName: shiftData.employeeName || 'NOMBRE_NO_PROVISTO',
                    objectiveName: shiftData.objectiveName || 'OBJETIVO_NO_PROVISTO',
                    startTime: admin.firestore.Timestamp.fromDate(newStart),
                    endTime: admin.firestore.Timestamp.fromDate(newEnd),
                    status: 'Assigned',
                    schedulerId: userAuth.uid,
                    updatedAt: admin.firestore.Timestamp.now(),
                    role: shiftData.role || 'Vigilador'
                };
                transaction.set(newShiftRef, finalShift);
                return finalShift.id;
            });
            return { id: newShiftRef.id, ...shiftData };
        }
        catch (error) {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            const errorMessage = error.message || 'Error desconocido';
            if (errorMessage.includes('LÍMITE') || errorMessage.includes('BLOQUEO') || errorMessage.includes('ausente')) {
                throw new functions.https.HttpsError('failed-precondition', errorMessage);
            }
            console.error(`[SCHEDULING_TRANSACTION_FAILURE] ${errorMessage}`, error.stack);
            throw new functions.https.HttpsError('internal', `Error en la asignación: ${errorMessage}`);
        }
    }
    async updateShift(shiftId, updateData) {
        const db = this.getDb();
        const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
        const safeUpdate = { ...updateData };
        delete safeUpdate.id;
        delete safeUpdate.employeeId;
        if (safeUpdate.startTime) {
            safeUpdate.startTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.startTime));
        }
        if (safeUpdate.endTime) {
            safeUpdate.endTime = admin.firestore.Timestamp.fromDate(this.convertToDate(safeUpdate.endTime));
        }
        safeUpdate.updatedAt = admin.firestore.Timestamp.now();
        await shiftRef.update(safeUpdate);
    }
    async deleteShift(shiftId) {
        const db = this.getDb();
        await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
    }
};
exports.SchedulingService = SchedulingService;
exports.SchedulingService = SchedulingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shift_overlap_service_1.ShiftOverlapService,
        workload_service_1.WorkloadService])
], SchedulingService);
//# sourceMappingURL=scheduling.service.js.map