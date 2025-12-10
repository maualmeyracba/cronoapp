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
    toDate(val) {
        if (!val)
            return new Date();
        if (val instanceof admin.firestore.Timestamp)
            return val.toDate();
        if (val._seconds)
            return new Date(val._seconds * 1000);
        if (typeof val === 'string')
            return new Date(val);
        return new Date(val);
    }
    getCycleDates(shiftDate, startDay, endDay) {
        const year = shiftDate.getFullYear();
        const month = shiftDate.getMonth();
        let cycleStart, cycleEnd;
        if (startDay >= 1 && startDay <= 31 && (endDay >= 1 && endDay <= 31 || endDay === 0)) {
            if (startDay <= endDay || endDay === 0) {
                cycleStart = new Date(year, month, startDay, 0, 0, 0);
                cycleEnd = endDay === 0
                    ? new Date(year, month + 1, 0, 23, 59, 59, 999)
                    : new Date(year, month, endDay, 23, 59, 59, 999);
            }
            else {
                if (shiftDate.getDate() >= startDay) {
                    cycleStart = new Date(year, month, startDay, 0, 0, 0);
                    cycleEnd = new Date(year, month + 1, endDay, 23, 59, 59, 999);
                }
                else {
                    cycleStart = new Date(year, month - 1, startDay, 0, 0, 0);
                    cycleEnd = new Date(year, month, endDay, 23, 59, 59, 999);
                }
            }
        }
        else {
            cycleStart = new Date(year, month, 1, 0, 0, 0);
            cycleEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
        return { cycleStart, cycleEnd };
    }
    async validateAssignment(employeeId, shiftStart, shiftEnd, excludeShiftId) {
        const db = this.getDb();
        const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
        if (!empDoc.exists)
            throw new common_1.BadRequestException('Empleado no encontrado');
        const employee = empDoc.data();
        console.log(`🔍 [Workload] Validando carga para: ${employee.name} (${employeeId})`);
        const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd, excludeShiftId);
        if (conflicts.length > 0) {
            const c = conflicts[0];
            const s = new Date(this.toDate(c.startTime).getTime() - 10800000);
            const e = new Date(this.toDate(c.endTime).getTime() - 10800000);
            const timeStr = `${s.toISOString().substring(11, 16)} - ${e.toISOString().substring(11, 16)}`;
            throw new common_1.ConflictException(`¡CONFLICTO! Ya tiene un turno asignado en ese horario: ${timeStr}`);
        }
        await this.checkAvailability(employeeId, shiftStart, shiftEnd);
        await this.checkMonthlyLimit(employee, shiftStart, shiftEnd, excludeShiftId);
    }
    async checkShiftOverlap(employeeId, start, end, excludeShiftId) {
        const db = this.getDb();
        const shiftsQuery = db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('endTime', '>', admin.firestore.Timestamp.fromDate(start));
        const snapshot = await shiftsQuery.get();
        const conflictingShifts = [];
        snapshot.forEach(doc => {
            if (excludeShiftId && doc.id === excludeShiftId)
                return;
            const shift = doc.data();
            if (shift.status === 'Canceled')
                return;
            const sStart = this.toDate(shift.startTime);
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
            .where('status', 'in', ['APPROVED', 'PENDING'])
            .get();
        absencesSnapshot.forEach(doc => {
            const absence = doc.data();
            const absStart = this.toDate(absence.startDate);
            const absEnd = this.toDate(absence.endDate);
            if (start.getTime() < absEnd.getTime() && end.getTime() > absStart.getTime()) {
                throw new common_1.ConflictException(`⛔ BLOQUEO: Licencia activa (${absence.type}).`);
            }
        });
    }
    async checkMonthlyLimit(employee, newShiftStart, newShiftEnd, excludeShiftId) {
        const db = this.getDb();
        const newDurationHours = (newShiftEnd.getTime() - newShiftStart.getTime()) / (1000 * 60 * 60);
        const { cycleStart: startOfCycle, cycleEnd: endOfCycle } = this.getCycleDates(newShiftStart, employee.payrollCycleStartDay || 1, employee.payrollCycleEndDay || 0);
        console.log(`📊 [Workload] Calculando ciclo: ${startOfCycle.toISOString()} a ${endOfCycle.toISOString()}`);
        const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employee.uid)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfCycle))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfCycle))
            .get();
        let accumulatedHours = 0;
        let count = 0;
        shiftsSnapshot.forEach(doc => {
            if (excludeShiftId && doc.id === excludeShiftId)
                return;
            const shift = doc.data();
            if (shift.status !== 'Canceled' && shift.status !== 'Completed') {
                const sStart = this.toDate(shift.startTime);
                const sEnd = this.toDate(shift.endTime);
                const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
                accumulatedHours += duration;
                count++;
            }
        });
        const totalProjected = accumulatedHours + newDurationHours;
        const maxHours = Number(employee.maxHoursPerMonth) || 176;
        if (totalProjected > maxHours) {
            const exceeded = (totalProjected - maxHours).toFixed(1);
            throw new common_1.ConflictException(`LÍMITE EXCEDIDO: ${employee.name} llega a ${totalProjected.toFixed(1)}h (Máx: ${maxHours}h). Exceso: ${exceeded}h. (Ciclo: ${startOfCycle.toLocaleDateString()} - ${endOfCycle.toLocaleDateString()})`);
        }
    }
    async getWorkloadReport(employeeId, month, year) {
        const db = this.getDb();
        const dateForCycle = new Date(year, month - 1, 15);
        const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
        const employee = empDoc.exists ? empDoc.data() : null;
        const maxHours = Number(employee?.maxHoursPerMonth) || 176;
        const { cycleStart: startOfCycle, cycleEnd: endOfCycle } = this.getCycleDates(dateForCycle, employee?.payrollCycleStartDay || 1, employee?.payrollCycleEndDay || 0);
        const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startOfCycle))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endOfCycle))
            .get();
        let assignedHours = 0;
        let completedHours = 0;
        const details = [];
        shiftsSnapshot.forEach(doc => {
            const shift = doc.data();
            const sStart = this.toDate(shift.startTime);
            const sEnd = this.toDate(shift.endTime);
            const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
            const status = shift.status;
            if (status !== 'Canceled' && status !== 'Completed') {
                assignedHours += duration;
            }
            if (status === 'Completed') {
                completedHours += duration;
            }
            details.push({
                shiftId: doc.id,
                objectiveName: shift.objectiveName,
                duration: parseFloat(duration.toFixed(1)),
                status: status,
                date: sStart.toLocaleDateString('es-AR'),
                startTime: sStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            });
        });
        return {
            assignedHours: parseFloat(assignedHours.toFixed(1)),
            completedHours: parseFloat(completedHours.toFixed(1)),
            maxHours,
            cycleStart: startOfCycle.toLocaleDateString('es-AR'),
            cycleEnd: endOfCycle.toLocaleDateString('es-AR'),
            details: details.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        };
    }
};
exports.WorkloadService = WorkloadService;
exports.WorkloadService = WorkloadService = __decorate([
    (0, common_1.Injectable)()
], WorkloadService);
//# sourceMappingURL=workload.service.js.map