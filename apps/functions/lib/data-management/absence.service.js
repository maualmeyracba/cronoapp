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
exports.AbsenceService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const workload_service_1 = require("../scheduling/workload.service");
let AbsenceService = class AbsenceService {
    constructor(workloadService) {
        this.workloadService = workloadService;
        this.getDb = () => admin.app().firestore();
        this.absencesCollection = 'ausencias';
        this.shiftsCollection = 'turnos';
    }
    async createAbsence(payload) {
        const parseDate = (input) => {
            if (typeof input === 'string')
                return new Date(input);
            if (input && input.seconds)
                return new Date(input.seconds * 1000);
            return new Date(input);
        };
        const startDateObj = parseDate(payload.startDate);
        const endDateObj = parseDate(payload.endDate);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Fechas inválidas recibidas en el backend.');
        }
        const conflictingShifts = await this.workloadService.checkShiftOverlap(payload.employeeId, startDateObj, endDateObj);
        const db = this.getDb();
        const batch = db.batch();
        if (conflictingShifts.length > 0) {
            console.log(`[AbsenceService] Se encontraron ${conflictingShifts.length} turnos afectados. Procesando bajas...`);
            conflictingShifts.forEach(shift => {
                const shiftRef = db.collection(this.shiftsCollection).doc(shift.id);
                batch.update(shiftRef, {
                    status: 'Canceled',
                    description: `Cancelación automática por Ausencia: ${payload.reason}`,
                    updatedAt: admin.firestore.Timestamp.now()
                });
            });
        }
        const startTimestamp = admin.firestore.Timestamp.fromDate(startDateObj);
        const endTimestamp = admin.firestore.Timestamp.fromDate(endDateObj);
        const newAbsence = {
            employeeId: payload.employeeId,
            employeeName: payload.employeeName,
            clientId: payload.clientId,
            type: payload.type,
            startDate: startTimestamp,
            endDate: endTimestamp,
            reason: payload.reason,
            status: 'APPROVED',
            createdAt: admin.firestore.Timestamp.now(),
            impactedShiftsCount: conflictingShifts.length
        };
        const newAbsenceRef = db.collection(this.absencesCollection).doc();
        batch.set(newAbsenceRef, newAbsence);
        await batch.commit();
        return { id: newAbsenceRef.id, ...newAbsence };
    }
};
exports.AbsenceService = AbsenceService;
exports.AbsenceService = AbsenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workload_service_1.WorkloadService])
], AbsenceService);
//# sourceMappingURL=absence.service.js.map