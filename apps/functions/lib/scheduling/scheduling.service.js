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
exports.SchedulingService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const shift_overlap_service_1 = require("./shift-overlap.service");
const workload_service_1 = require("./workload.service");
const functions = __importStar(require("firebase-functions"));
const SHIFTS_COLLECTION = 'turnos';
let SchedulingService = class SchedulingService {
    constructor(overlapService, workloadService) {
        this.overlapService = overlapService;
        this.workloadService = workloadService;
        // Inicialización diferida (Lazy Init)
        this.getDb = () => admin.app().firestore();
    }
    /**
     * 🛑 FIX CRÍTICO: Función auxiliar para sanear fechas que vienen por la red.
     * Maneja: Firestore Timestamp, Serialized Timestamp ({_seconds}), Strings e ISOs.
     */
    convertToDate(input) {
        if (!input)
            throw new Error('Fecha inválida o inexistente.');
        // Caso 1: Es un Timestamp de Firestore real (tiene .toDate)
        if (typeof input.toDate === 'function') {
            return input.toDate();
        }
        // Caso 2: Es un Timestamp serializado (viene del Frontend como JSON)
        if (input._seconds !== undefined) {
            return new Date(input._seconds * 1000);
        }
        // Caso 3: Es un objeto seconds/nanoseconds estándar de Google
        if (input.seconds !== undefined) {
            return new Date(input.seconds * 1000);
        }
        // Caso 4: Es un string ISO o número
        return new Date(input);
    }
    async assignShift(shiftData, userAuth) {
        const dbInstance = this.getDb();
        const newShiftRef = dbInstance.collection(SHIFTS_COLLECTION).doc();
        // 1. Validación de campos requeridos
        if (!shiftData.startTime || !shiftData.endTime || !shiftData.employeeId || !shiftData.objectiveId) {
            throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos: inicio, fin, empleado u objetivo.');
        }
        // 🛑 USAMOS LA NUEVA FUNCIÓN DE CONVERSIÓN AQUÍ
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
        // 2. Validación de coherencia temporal
        if (newStart.getTime() >= newEnd.getTime()) {
            throw new common_1.BadRequestException('La hora de inicio debe ser anterior a la hora de fin.');
        }
        // 3. VALIDACIÓN DE REGLAS DE NEGOCIO (WFM)
        try {
            await this.workloadService.validateAssignment(employeeId, newStart, newEnd);
        }
        catch (businessRuleError) {
            console.warn(`[BUSINESS_RULE_BLOCK] ${businessRuleError.message}`);
            throw new functions.https.HttpsError('failed-precondition', businessRuleError.message);
        }
        try {
            await dbInstance.runTransaction(async (transaction) => {
                // 4. Verificación de Solapamiento
                const overlappingQuery = dbInstance.collection(SHIFTS_COLLECTION)
                    .where('employeeId', '==', employeeId)
                    .where('endTime', '>', newStart)
                    .where('startTime', '<', newEnd)
                    .limit(1);
                const snapshot = await transaction.get(overlappingQuery);
                if (!snapshot.empty) {
                    const existingShift = snapshot.docs[0].data(); // Data cruda
                    // Convertimos también las fechas de la DB por seguridad
                    const existingStart = this.convertToDate(existingShift.startTime);
                    const existingEnd = this.convertToDate(existingShift.endTime);
                    if (this.overlapService.isOverlap(existingStart, existingEnd, newStart, newEnd)) {
                        console.error(`[SCHEDULING_ABORTED] Overlap detected for Employee: ${employeeId}.`);
                        throw new functions.https.HttpsError('already-exists', 'El empleado ya tiene otro turno asignado en este horario.');
                    }
                }
                // Escritura del nuevo turno
                const finalShift = {
                    id: newShiftRef.id,
                    employeeId: employeeId,
                    objectiveId: shiftData.objectiveId,
                    employeeName: shiftData.employeeName || 'NOMBRE_NO_PROVISTO',
                    objectiveName: shiftData.objectiveName || 'OBJETIVO_NO_PROVISTO',
                    // Guardamos como Timestamp de Firestore para consistencia en la DB
                    startTime: admin.firestore.Timestamp.fromDate(newStart),
                    endTime: admin.firestore.Timestamp.fromDate(newEnd),
                    status: 'Assigned',
                    schedulerId: userAuth.uid,
                    updatedAt: admin.firestore.Timestamp.now(),
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
                console.warn(`[BUSINESS_RULE_VIOLATION] ${errorMessage}`);
                throw new functions.https.HttpsError('failed-precondition', errorMessage);
            }
            console.error(`[SCHEDULING_TRANSACTION_FAILURE] ${errorMessage}`, error.stack);
            throw new functions.https.HttpsError('internal', `Error en la asignación: ${errorMessage}`);
        }
    }
};
exports.SchedulingService = SchedulingService;
exports.SchedulingService = SchedulingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shift_overlap_service_1.ShiftOverlapService,
        workload_service_1.WorkloadService])
], SchedulingService);
//# sourceMappingURL=scheduling.service.js.map