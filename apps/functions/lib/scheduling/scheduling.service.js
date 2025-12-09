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
const ABSENCES_COLLECTION = 'ausencias';
let SchedulingService = class SchedulingService {
    constructor(overlapService, workloadService) {
        this.overlapService = overlapService;
        this.workloadService = workloadService;
        this.getDb = () => admin.app().firestore();
    }
    convertToDate(input) {
        if (!input)
            return new Date();
        if (input instanceof admin.firestore.Timestamp)
            return input.toDate();
        if (typeof input.toDate === 'function')
            return input.toDate();
        if (input._seconds !== undefined)
            return new Date(input._seconds * 1000);
        return new Date(input);
    }
    async checkAbsenceConflict(employeeId, shiftStart, shiftEnd) {
        if (employeeId === 'VACANTE')
            return;
        const db = this.getDb();
        console.log(`🕵️‍♂️ Validando ausencias para ${employeeId} entre ${shiftStart.toISOString()} y ${shiftEnd.toISOString()}`);
        const absencesSnap = await db.collection(ABSENCES_COLLECTION)
            .where('employeeId', '==', employeeId)
            .get();
        if (absencesSnap.empty) {
            console.log("✅ No se encontraron registros de ausencia para este empleado.");
            return;
        }
        const conflict = absencesSnap.docs.find(doc => {
            const data = doc.data();
            if (data.status === 'rejected' || data.status === 'cancelled')
                return false;
            const absStart = this.convertToDate(data.startDate);
            const absEnd = this.convertToDate(data.endDate);
            const shiftStartMs = shiftStart.getTime();
            const shiftEndMs = shiftEnd.getTime();
            const absStartMs = absStart.getTime();
            const absEndMs = absEnd.getTime();
            console.log(`   --> Comparando con Ausencia: ${absStart.toISOString()} - ${absEnd.toISOString()} (${data.type || 'Licencia'})`);
            const isOverlapping = (shiftStartMs < absEndMs) && (shiftEndMs > absStartMs);
            if (isOverlapping) {
                console.warn(`   ⛔ CONFLICTO DETECTADO con ausencia ID: ${doc.id}`);
            }
            return isOverlapping;
        });
        if (conflict) {
            const data = conflict.data();
            throw new functions.https.HttpsError('failed-precondition', `⛔ BLOQUEO: El empleado está de licencia/ausente (${data.type || 'Motivo no especificado'}) en esas fechas.`);
        }
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
            throw new common_1.BadRequestException('Horario inválido (Inicio >= Fin).');
        if (employeeId !== 'VACANTE') {
            try {
                await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
            }
            catch (error) {
                console.warn(`⛔ Workload Block: ${error.message}`);
                throw new functions.https.HttpsError('resource-exhausted', error.message || 'El empleado excede el límite de horas.');
            }
        }
        await this.checkAbsenceConflict(employeeId, newStart, newEnd);
        try {
            await dbInstance.runTransaction(async (transaction) => {
                if (employeeId !== 'VACANTE') {
                    const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
                        .where('employeeId', '==', employeeId)
                        .where('endTime', '>', newStart)
                        .orderBy('endTime')
                        .limit(5);
                    const snapshot = await transaction.get(overlappingQuery);
                    const hasOverlap = snapshot.docs.some(doc => {
                        const data = doc.data();
                        if (data.status === 'Canceled')
                            return false;
                        const existStart = this.convertToDate(data.startTime);
                        const existEnd = this.convertToDate(data.endTime);
                        return this.overlapService.isOverlap(existStart, existEnd, newStart, newEnd);
                    });
                    if (hasOverlap) {
                        throw new functions.https.HttpsError('already-exists', '⛔ El empleado ya tiene OTRO TURNO asignado que se superpone con este horario.');
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
                transaction.set(newShiftRef, finalShift);
            });
            return { id: newShiftRef.id, ...shiftData };
        }
        catch (error) {
            if (error instanceof functions.https.HttpsError)
                throw error;
            throw new functions.https.HttpsError('internal', error.message || 'Error interno al asignar turno.');
        }
    }
    async updateShift(shiftId, updateData) {
        const db = this.getDb();
        const shiftRef = db.collection(SHIFTS_COLLECTION).doc(shiftId);
        const currentDoc = await shiftRef.get();
        if (!currentDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
        const currentShift = currentDoc.data();
        const effectiveEmployeeId = updateData.employeeId || currentShift.employeeId;
        const effectiveStart = updateData.startTime ? this.convertToDate(updateData.startTime) : this.convertToDate(currentShift.startTime);
        const effectiveEnd = updateData.endTime ? this.convertToDate(updateData.endTime) : this.convertToDate(currentShift.endTime);
        const isRealEmployee = effectiveEmployeeId !== 'VACANTE';
        const datesChanged = (updateData.startTime || updateData.endTime);
        const employeeChanged = (updateData.employeeId && updateData.employeeId !== currentShift.employeeId);
        if (isRealEmployee && (datesChanged || employeeChanged)) {
            console.log(`🔄 Validando actualización para ${effectiveEmployeeId}...`);
            try {
                await this.workloadService.validateAssignment(effectiveEmployeeId, effectiveStart, effectiveEnd, shiftId);
            }
            catch (e) {
                throw new functions.https.HttpsError('resource-exhausted', `⛔ Límite de Horas: ${e.message}`);
            }
            await this.checkAbsenceConflict(effectiveEmployeeId, effectiveStart, effectiveEnd);
            const overlap = await this.checkOverlapSimple(effectiveEmployeeId, effectiveStart, effectiveEnd, shiftId);
            if (overlap) {
                throw new functions.https.HttpsError('already-exists', '⛔ Solapamiento: El empleado ya trabaja en ese horario en otro lugar.');
            }
        }
        const safeUpdate = { ...updateData };
        delete safeUpdate.id;
        if (safeUpdate.startTime)
            safeUpdate.startTime = admin.firestore.Timestamp.fromDate(effectiveStart);
        if (safeUpdate.endTime)
            safeUpdate.endTime = admin.firestore.Timestamp.fromDate(effectiveEnd);
        safeUpdate.updatedAt = admin.firestore.Timestamp.now();
        await shiftRef.update(safeUpdate);
    }
    async checkOverlapSimple(employeeId, start, end, excludeShiftId) {
        const db = this.getDb();
        const snapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('endTime', '>', start)
            .get();
        return snapshot.docs.some(doc => {
            if (doc.id === excludeShiftId)
                return false;
            const data = doc.data();
            if (data.status === 'Canceled')
                return false;
            const s = this.convertToDate(data.startTime);
            const e = this.convertToDate(data.endTime);
            return this.overlapService.isOverlap(s, e, start, end);
        });
    }
    async deleteShift(shiftId) {
        const db = this.getDb();
        await db.collection(SHIFTS_COLLECTION).doc(shiftId).delete();
    }
    async replicateDailyStructure(objectiveId, sourceDateStr, targetStartDateStr, targetEndDateStr, schedulerId, targetDays) {
        const db = this.getDb();
        const TZ_OFFSET_HOURS = 3;
        const sourceDate = new Date(sourceDateStr + 'T00:00:00');
        const startSource = new Date(sourceDate);
        startSource.setHours(startSource.getHours() + TZ_OFFSET_HOURS);
        const endSource = new Date(startSource);
        endSource.setHours(startSource.getHours() + 23, 59, 59, 999);
        const sourceShiftsSnap = await db.collection(SHIFTS_COLLECTION)
            .where('objectiveId', '==', objectiveId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startSource))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endSource))
            .get();
        if (sourceShiftsSnap.empty)
            throw new functions.https.HttpsError('not-found', 'El día origen no tiene turnos.');
        const sourceShifts = sourceShiftsSnap.docs.map(doc => doc.data()).filter(s => s.status !== 'Canceled');
        const batch = db.batch();
        let opCount = 0;
        let skipped = 0;
        const MAX_BATCH_SIZE = 450;
        const allowedDays = targetDays && targetDays.length > 0 ? targetDays : [0, 1, 2, 3, 4, 5, 6];
        const startTarget = new Date(targetStartDateStr + 'T00:00:00');
        const endTarget = new Date(targetEndDateStr + 'T00:00:00');
        const loopStart = new Date(startTarget);
        const loopEnd = new Date(endTarget);
        for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
            if (!allowedDays.includes(d.getDay()))
                continue;
            const dayStartUTC = new Date(d);
            dayStartUTC.setHours(dayStartUTC.getHours() + TZ_OFFSET_HOURS);
            const dayEndUTC = new Date(dayStartUTC);
            dayEndUTC.setHours(dayStartUTC.getHours() + 23, 59, 59, 999);
            const existingCheck = await db.collection(SHIFTS_COLLECTION)
                .where('objectiveId', '==', objectiveId)
                .where('startTime', '>=', admin.firestore.Timestamp.fromDate(dayStartUTC))
                .where('startTime', '<=', admin.firestore.Timestamp.fromDate(dayEndUTC))
                .get();
            if (existingCheck.empty) {
                skipped++;
                continue;
            }
            const existingShifts = existingCheck.docs.map(doc => ({ ref: doc.ref, data: doc.data() }));
            const hasRealEmployees = existingShifts.some(s => s.data.employeeId !== 'VACANTE' && s.data.status !== 'Canceled');
            if (hasRealEmployees) {
                skipped++;
                continue;
            }
            existingShifts.forEach(s => { batch.delete(s.ref); opCount++; });
            for (const template of sourceShifts) {
                const tStart = this.convertToDate(template.startTime);
                const tEnd = this.convertToDate(template.endTime);
                const msFromStartOfDay = tStart.getTime() - startSource.getTime();
                const durationMs = tEnd.getTime() - tStart.getTime();
                const newStart = new Date(dayStartUTC.getTime() + msFromStartOfDay);
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
                    updatedAt: admin.firestore.Timestamp.now()
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