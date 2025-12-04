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
exports.DataManagementService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const CLIENTS_COLLECTION = 'clientes';
const OBJECTIVES_COLLECTION = 'objetivos';
// 🛑 ELIMINADO: const db = admin.firestore(); // Eliminado para resolver el error 'app/no-app'
/**
 * @class DataManagementService
 * @description Servicio CRUD para las entidades Cliente y Objetivo (P1).
 */
let DataManagementService = class DataManagementService {
    constructor() {
        // 🔑 FIX: Getter para asegurar que Firestore solo se accede después de initializeApp()
        this.getDb = () => admin.app().firestore();
    }
    // --- CRUD para Objetivos (Sucursales/Puestos) ---
    async createObjective(objectiveData) {
        const dbInstance = this.getDb();
        const newRef = dbInstance.collection(OBJECTIVES_COLLECTION).doc();
        const objective = {
            ...objectiveData,
            id: newRef.id,
        };
        await newRef.set(objective);
        return objective;
    }
    async findAllObjectives(clientId) {
        const dbInstance = this.getDb();
        let query = dbInstance.collection(OBJECTIVES_COLLECTION);
        if (clientId) {
            query = query.where('clientId', '==', clientId);
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => doc.data());
    }
    // --- Métodos de Lectura (Críticos para el Check-In) ---
    async getClientById(clientId) {
        const dbInstance = this.getDb();
        const doc = await dbInstance.collection(CLIENTS_COLLECTION).doc(clientId).get();
        if (!doc.exists) {
            throw new common_1.NotFoundException(`Client with ID ${clientId} not found.`);
        }
        return doc.data();
    }
    async getObjectiveById(objectiveId) {
        const dbInstance = this.getDb();
        const doc = await dbInstance.collection(OBJECTIVES_COLLECTION).doc(objectiveId).get();
        if (!doc.exists) {
            throw new common_1.NotFoundException(`Objective with ID ${objectiveId} not found.`);
        }
        return doc.data();
    }
};
exports.DataManagementService = DataManagementService;
exports.DataManagementService = DataManagementService = __decorate([
    (0, common_1.Injectable)()
], DataManagementService);
//# sourceMappingURL=data-management.service.js.map