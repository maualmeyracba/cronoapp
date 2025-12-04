"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkloadService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const EMPLOYEES_COLLECTION = 'empleados';
const ABSENCES_COLLECTION = 'ausencias';
const SHIFTS_COLLECTION = 'turnos';
let WorkloadService = class WorkloadService {
    constructor() {
        this.getDb = () => admin.app().firestore();
    }
    async validateAssignment(employeeId, shiftStart, shiftEnd) {
        const db = this.getDb();
        const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
        if (!empDoc.exists)
            throw new common_1.BadRequestException('Employee not found');
        const employee = empDoc.data();
        const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd);
        if (conflicts.length > 0) {
            throw new common_1.ConflictException('SOLAPAMIENTO DETECTADO: El empleado ya tiene un turno asignado en este período.');
        }
        await this.checkAvailability(employeeId, shiftStart, shiftEnd);
        await this.checkMonthlyLimit(employee, shiftStart, shiftEnd);
    }
    async checkShiftOverlap(employeeId, start, end) {
        const db = this.getDb();
        const shiftsQuery = db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('endTime', '>', start);
        const snapshot = await shiftsQuery.get();
        const conflictingShifts = [];
        snapshot.forEach(doc => {
            const shift = doc.data();
            const sStart = shift.startTime.toDate();
            if (sStart.getTime() < end.getTime()) {
                conflictingShifts.push({ id: doc.id, ...shift });
            }
        });
        return conflictingShifts;
    }
    async checkAvailability(employeeId, start, end) {
        const db = this.getDb();
        const absencesSnapshot = await db.collection(ABSENCES_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('endDate', '>=', start)
            .get();
        absencesSnapshot.forEach(doc => {
            const absence = doc.data();
            const absStart = absence.startDate.toDate();
            const absEnd = absence.endDate.toDate();
            if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
                throw new common_1.ConflictException(`BLOQUEO: El empleado está ausente por: ${absence.type}`);
            }
        });
    }
    async checkMonthlyLimit(employee, newShiftStart, newShiftEnd) {
        const db = this.getDb();
        const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);
        const startOfMonth = new Date(newShiftStart.getFullYear(), newShiftStart.getMonth(), 1);
        const endOfMonth = new Date(newShiftStart.getFullYear(), newShiftStart.getMonth() + 1, 0, 23, 59, 59);
        const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employee.uid)
            .where('startTime', '>=', startOfMonth)
            .where('startTime', '<=', endOfMonth)
            .get();
        let accumulatedHours = 0;
        shiftsSnapshot.forEach(doc => {
            const shift = doc.data();
            const sStart = shift.startTime.toDate();
            const sEnd = shift.endTime.toDate();
            const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
            accumulatedHours += duration;
        });
        const totalProjected = accumulatedHours + newDurationHours;
        const maxHours = employee.maxHoursPerMonth || 176;
        if (totalProjected > maxHours) {
            throw new common_1.ConflictException(`LÍMITE EXCEDIDO: Acumulado(${accumulatedHours.toFixed(1)}h) + Nuevo supera el máximo.`);
        }
    }
};
exports.WorkloadService = WorkloadService;
exports.WorkloadService = WorkloadService = __decorate([
    (0, common_1.Injectable)()
], WorkloadService);
//# sourceMappingURL=workload.service.js.map