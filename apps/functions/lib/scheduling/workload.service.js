"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkloadService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const EMPLOYEES_COLLECTION = 'empleados';
const ABSENCES_COLLECTION = 'ausencias';
const SHIFTS_COLLECTION = 'turnos';
let WorkloadService = class WorkloadService {
    constructor() {
        // 🔑 Inicialización diferida (Lazy Loading)
        this.getDb = () => admin.app().firestore();
    }
    /**
     * Valida TODAS las reglas de negocio antes de asignar un turno.
     */
    async validateAssignment(employeeId, shiftStart, shiftEnd) {
        const db = this.getDb();
        // 1. Obtener datos del empleado
        const empDoc = await db.collection(EMPLOYEES_COLLECTION).doc(employeeId).get();
        if (!empDoc.exists)
            throw new common_1.BadRequestException('Employee not found');
        const employee = empDoc.data();
        // REGLA 1: DISPONIBILIDAD
        await this.checkAvailability(employeeId, shiftStart, shiftEnd);
        // REGLA 2: LÍMITE MENSUAL
        await this.checkMonthlyLimit(employee, shiftStart, shiftEnd);
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
            if (start < absEnd && end > absStart) {
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
            const sStart = shift.startTime.toDate ? shift.startTime.toDate() : new Date(shift.startTime.seconds * 1000);
            const sEnd = shift.endTime.toDate ? shift.endTime.toDate() : new Date(shift.endTime.seconds * 1000);
            const duration = (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
            accumulatedHours += duration;
        });
        const totalProjected = accumulatedHours + newDurationHours;
        const maxHours = employee.maxHoursPerMonth || 176;
        if (totalProjected > maxHours) {
            throw new common_1.ConflictException(`LÍMITE EXCEDIDO: Acumulado(${accumulatedHours.toFixed(1)}h) + Nuevo(${newDurationHours.toFixed(1)}h) supera el máximo de ${maxHours}h.`);
        }
    }
};
exports.WorkloadService = WorkloadService;
exports.WorkloadService = WorkloadService = __decorate([
    (0, common_1.Injectable)()
], WorkloadService);
//# sourceMappingURL=workload.service.js.map