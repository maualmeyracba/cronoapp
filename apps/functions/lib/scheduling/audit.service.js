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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const geofencing_service_1 = require("./geofencing.service");
const data_management_service_1 = require("../data-management/data-management.service");
const functions = __importStar(require("firebase-functions"));
const SHIFTS_COLLECTION = 'turnos';
// 🛑 ELIMINADO: const db = admin.firestore(); // <--- ESTO CAUSABA EL ERROR
let AuditService = class AuditService {
    constructor(geofencingService, dmService) {
        this.geofencingService = geofencingService;
        this.dmService = dmService;
        // 🔑 FIX: Getter privado para Inicialización Diferida (Lazy Init)
        this.getDb = () => admin.app().firestore();
    }
    async auditShiftAction(shiftId, action, employeeCoords, employeeUid) {
        const dbInstance = this.getDb(); // 🛑 Usar la instancia diferida
        const shiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc(shiftId);
        return dbInstance.runTransaction(async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists) {
                throw new common_1.BadRequestException('Shift not found.');
            }
            const shift = shiftDoc.data();
            // Regla 1: Autorización de Propiedad
            if (shift.employeeId !== employeeUid) {
                throw new common_1.ForbiddenException('No estás autorizado para modificar este turno.');
            }
            // Regla 2: Obtener Coordenadas del Objetivo
            const objective = await this.dmService.getObjectiveById(shift.objectiveId);
            // Regla 3: Verificación de Geofence (P4)
            const objectiveCoords = objective.location;
            if (!this.geofencingService.isInGeofence(employeeCoords, objectiveCoords)) {
                console.warn(`Geofence failed for ${employeeUid} at shift ${shiftId}.`);
                throw new functions.https.HttpsError('failed-precondition', 'Debe estar cerca del objetivo para registrar la acción.');
            }
            // Regla 4: Lógica de Estado y Actualización
            const now = admin.firestore.Timestamp.now();
            let newStatus;
            if (action === 'CHECK_IN' && shift.status === 'Assigned') {
                newStatus = 'InProgress';
                shift.checkInTime = now;
            }
            else if (action === 'CHECK_OUT' && shift.status === 'InProgress') {
                newStatus = 'Completed';
                shift.checkOutTime = now;
            }
            else {
                throw new common_1.BadRequestException(`Acción ${action} inválida para el estado actual: ${shift.status}.`);
            }
            // Actualización Atómica
            shift.status = newStatus;
            shift.updatedAt = now;
            transaction.update(shiftRef, shift);
            return shift;
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [geofencing_service_1.GeofencingService,
        data_management_service_1.DataManagementService])
], AuditService);
//# sourceMappingURL=audit.service.js.map