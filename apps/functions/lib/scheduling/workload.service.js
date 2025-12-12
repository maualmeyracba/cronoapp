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
exports.WorkloadService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const date_fns_1 = require("date-fns");
const labor_agreement_service_1 = require("../data-management/labor-agreement.service");
const EMPLOYEES_COLLECTION = 'empleados';
const ABSENCES_COLLECTION = 'ausencias';
const SHIFTS_COLLECTION = 'turnos';
let WorkloadService = class WorkloadService {
    constructor(agreementService) {
        this.agreementService = agreementService;
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
        console.log(`🔍 [Workload] Validando para: ${employee.name} (${employeeId}) | Convenio: ${employee.laborAgreement || 'SUVICO'}`);
        const agreementCode = employee.laborAgreement || 'SUVICO';
        let rules = await this.agreementService.getAgreementByCode(agreementCode);
        if (!rules) {
            console.warn(`⚠️ No se encontraron reglas para ${agreementCode}, usando defaults.`);
            rules = { maxHoursWeekly: 48, maxHoursMonthly: 200, saturdayCutoffHour: 13 };
        }
        const conflicts = await this.checkShiftOverlap(employeeId, shiftStart, shiftEnd, excludeShiftId);
        if (conflicts.length > 0) {
            throw new common_1.ConflictException(`¡CONFLICTO! Ya tiene un turno asignado en ese horario.`);
        }
        await this.checkAvailability(employeeId, shiftStart, shiftEnd);
        await this.checkWeeklyLimit(employeeId, shiftStart, shiftEnd, rules.maxHoursWeekly, excludeShiftId);
        await this.checkMonthlyLimit(employee, shiftStart, shiftEnd, excludeShiftId);
        const breakdown = await this.calculateShiftBreakdown(employee, (0, date_fns_1.startOfWeek)(shiftStart), shiftStart, shiftEnd, rules);
        return breakdown;
    }
    async checkWeeklyLimit(employeeId, start, end, limitWeekly, excludeShiftId) {
        const db = this.getDb();
        const weekStart = (0, date_fns_1.startOfWeek)(start, { weekStartsOn: 1 });
        const weekEnd = (0, date_fns_1.endOfWeek)(start, { weekStartsOn: 1 });
        const shiftsSnap = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(weekStart))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(weekEnd))
            .get();
        let accumulatedHours = 0;
        shiftsSnap.forEach(doc => {
            if (excludeShiftId && doc.id === excludeShiftId)
                return;
            const data = doc.data();
            if (data.status === 'Canceled')
                return;
            const s = this.toDate(data.startTime);
            const e = this.toDate(data.endTime);
            accumulatedHours += (e.getTime() - s.getTime()) / (1000 * 60 * 60);
        });
        const newDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const totalProjected = accumulatedHours + newDuration;
        if (totalProjected > limitWeekly) {
            const excess = (totalProjected - limitWeekly).toFixed(1);
            throw new common_1.ConflictException(`LÍMITE SEMANAL EXCEDIDO: ${totalProjected.toFixed(1)}h esta semana (Máx: ${limitWeekly}h). Exceso: ${excess}h.`);
        }
    }
    async calculateShiftBreakdown(employee, weekStart, start, end, rules) {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return {
            totalDuration: duration,
            breakdown: { normal: duration, fifty: 0, hundred: 0, night: 0 },
            agreementUsed: rules.code || 'STANDARD'
        };
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
        const { cycleStart, cycleEnd } = this.getCycleDates(newShiftStart, employee.payrollCycleStartDay || 1, employee.payrollCycleEndDay || 0);
        console.log(`📊 [Workload] Calculando ciclo para Soft Block: ${cycleStart.toISOString()} - ${cycleEnd.toISOString()}`);
        const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employee.uid)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(cycleStart))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(cycleEnd))
            .get();
        let accumulatedHours = 0;
        shiftsSnapshot.forEach(doc => {
            if (excludeShiftId && doc.id === excludeShiftId)
                return;
            const shift = doc.data();
            if (shift.status !== 'Canceled' && shift.status !== 'Completed') {
                const sStart = this.toDate(shift.startTime);
                const sEnd = this.toDate(shift.endTime);
                accumulatedHours += (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
            }
        });
        const totalProjected = accumulatedHours + newDurationHours;
        const maxHours = Number(employee.maxHoursPerMonth) || 176;
        if (totalProjected > maxHours) {
            const exceeded = (totalProjected - maxHours).toFixed(1);
            throw new common_1.ConflictException(`LÍMITE MENSUAL EXCEDIDO: ${employee.name} llega a ${totalProjected.toFixed(1)}h (Máx: ${maxHours}h). Exceso: ${exceeded}h.`);
        }
    }
    async getWorkloadReport(employeeId, month, year) {
        const db = this.getDb();
        const dateForCycle = new Date(year, month - 1, 15);
        const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
        const employee = empDoc.exists ? empDoc.data() : null;
        const maxHours = Number(employee?.maxHoursPerMonth) || 176;
        const { cycleStart, cycleEnd } = this.getCycleDates(dateForCycle, employee?.payrollCycleStartDay || 1, employee?.payrollCycleEndDay || 0);
        const shiftsSnapshot = await db.collection(SHIFTS_COLLECTION)
            .where('employeeId', '==', employeeId)
            .where('startTime', '>=', admin.firestore.Timestamp.fromDate(cycleStart))
            .where('startTime', '<=', admin.firestore.Timestamp.fromDate(cycleEnd))
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
            if (status !== 'Canceled' && status !== 'Completed')
                assignedHours += duration;
            if (status === 'Completed')
                completedHours += duration;
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
            cycleStart: cycleStart.toLocaleDateString('es-AR'),
            cycleEnd: cycleEnd.toLocaleDateString('es-AR'),
            details: details.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        };
    }
};
exports.WorkloadService = WorkloadService;
exports.WorkloadService = WorkloadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [labor_agreement_service_1.LaborAgreementService])
], WorkloadService);
//# sourceMappingURL=workload.service.js.map