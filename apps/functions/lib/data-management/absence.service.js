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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsenceService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin")); // 🛑 CORREGIDO: Importación de módulo
const workload_service_1 = require("../scheduling/workload.service");
let AbsenceService = class AbsenceService {
    constructor(workloadService) {
        this.workloadService = workloadService;
        this.getDb = () => admin.app().firestore();
        this.absencesCollection = this.getDb().collection('absences');
    }
    async createAbsence(payload) {
        const { employeeId, startDate, endDate, clientId } = payload;
        // Convertimos los inputs a Timestamps de Firestore para consistencia
        const startTimestamp = startDate;
        const endTimestamp = endDate;
        // 1. Validar solapamiento (Usa el método recién agregado en WorkloadService)
        // Usamos .toDate() porque WorkloadService trabaja con objetos Date de JS
        const conflictingShifts = await this.workloadService.checkShiftOverlap(employeeId, startTimestamp.toDate(), endTimestamp.toDate());
        if (conflictingShifts.length > 0) {
            console.warn(`[AbsenceService] Conflict found for employee ${employeeId}`);
            throw new common_1.ConflictException(`Conflict: Employee has ${conflictingShifts.length} shifts assigned during this period.`);
        }
        // 2. Crear el objeto a persistir
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
        };
        const docRef = await this.absencesCollection.add(newAbsence);
        return { id: docRef.id, ...newAbsence };
    }
};
exports.AbsenceService = AbsenceService;
exports.AbsenceService = AbsenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workload_service_1.WorkloadService])
], AbsenceService);
//# sourceMappingURL=absence.service.js.map