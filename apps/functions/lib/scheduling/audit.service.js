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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const geofencing_service_1 = require("./geofencing.service");
const data_management_service_1 = require("../data-management/data-management.service");
const functions = require("firebase-functions");
const SHIFTS_COLLECTION = 'turnos';
let AuditService = class AuditService {
    constructor(geofencingService, dmService) {
        this.geofencingService = geofencingService;
        this.dmService = dmService;
        this.getDb = () => admin.app().firestore();
    }
    async auditShiftAction(shiftId, action, employeeCoords, employeeUid) {
        const dbInstance = this.getDb();
        const shiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc(shiftId);
        return dbInstance.runTransaction(async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists) {
                throw new common_1.BadRequestException('Shift not found.');
            }
            const shift = shiftDoc.data();
            if (shift.employeeId !== employeeUid) {
                throw new common_1.ForbiddenException('No estás autorizado para modificar este turno.');
            }
            const objective = await this.dmService.getObjectiveById(shift.objectiveId);
            const objectiveCoords = objective.location;
            if (!this.geofencingService.isInGeofence(employeeCoords, objectiveCoords)) {
                console.warn(`Geofence failed for ${employeeUid} at shift ${shiftId}.`);
                throw new functions.https.HttpsError('failed-precondition', 'Debe estar cerca del objetivo para registrar la acción.');
            }
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