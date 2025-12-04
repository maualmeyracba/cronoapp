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
exports.ClientService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const COLL_CLIENTS = 'clientes';
const COLL_OBJECTIVES = 'objetivos';
const COLL_CONTRACTS = 'contratos_servicio';
const COLL_SHIFT_TYPES = 'tipos_turno';
let ClientService = class ClientService {
    constructor() {
        // 🔑 Inicialización diferida (Lazy Loading) para evitar error 'app/no-app'
        this.getDb = () => admin.app().firestore();
    }
    // ==========================================
    // 1. GESTIÓN DE CLIENTES (EMPRESAS)
    // ==========================================
    async createClient(data) {
        const db = this.getDb();
        const ref = db.collection(COLL_CLIENTS).doc();
        const newClient = {
            ...data,
            id: ref.id,
            createdAt: admin.firestore.Timestamp.now(),
        };
        await ref.set(newClient);
        return newClient;
    }
    async getClient(id) {
        const doc = await this.getDb().collection(COLL_CLIENTS).doc(id).get();
        if (!doc.exists)
            throw new common_1.NotFoundException('Cliente no encontrado');
        return { id: doc.id, ...doc.data() };
    }
    async findAllClients() {
        try {
            // Nota: Si quieres ver incluso los eliminados/inactivos, quita el .where
            const snapshot = await this.getDb().collection(COLL_CLIENTS)
                // .where('status', '==', 'Active') // Descomentar para filtrar solo activos
                .get();
            if (snapshot.empty)
                return [];
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
        catch (error) {
            console.error('[ERROR_FIND_CLIENTS]', error);
            throw new common_1.InternalServerErrorException('Error al consultar clientes.');
        }
    }
    // 🛑 NUEVO: Actualizar Cliente
    async updateClient(id, data) {
        const ref = this.getDb().collection(COLL_CLIENTS).doc(id);
        // Protección: No permitir modificar ID ni fecha de creación
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.createdAt;
        await ref.update(updateData);
    }
    // 🛑 NUEVO: Eliminar Cliente
    async deleteClient(id) {
        await this.getDb().collection(COLL_CLIENTS).doc(id).delete();
    }
    // ==========================================
    // 2. GESTIÓN DE OBJETIVOS (SEDES)
    // ==========================================
    async createObjective(data) {
        await this.getClient(data.clientId); // Validar existencia
        const db = this.getDb();
        const ref = db.collection(COLL_OBJECTIVES).doc();
        const newObjective = {
            ...data,
            id: ref.id,
        };
        await ref.set(newObjective);
        return newObjective;
    }
    async getObjectivesByClient(clientId) {
        const snapshot = await this.getDb().collection(COLL_OBJECTIVES)
            .where('clientId', '==', clientId)
            .get();
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    async getClientById(clientId) {
        return this.getClient(clientId);
    }
    async getObjectiveById(objectiveId) {
        const doc = await this.getDb().collection(COLL_OBJECTIVES).doc(objectiveId).get();
        if (!doc.exists) {
            throw new common_1.NotFoundException(`Objective with ID ${objectiveId} not found.`);
        }
        return { id: doc.id, ...doc.data() };
    }
    // ==========================================
    // 3. GESTIÓN DE CONTRATOS
    // ==========================================
    async createServiceContract(data) {
        const db = this.getDb();
        const ref = db.collection(COLL_CONTRACTS).doc();
        let startDate;
        // Manejo robusto de fechas entrantes (JSON o Date)
        if (data.startDate instanceof admin.firestore.Timestamp) {
            startDate = data.startDate;
        }
        else if (data.startDate._seconds) {
            startDate = new admin.firestore.Timestamp(data.startDate._seconds, data.startDate._nanoseconds);
        }
        else {
            startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
        }
        const newContract = {
            ...data,
            id: ref.id,
            startDate: startDate,
        };
        await ref.set(newContract);
        return newContract;
    }
    // ==========================================
    // 4. GESTIÓN DE MODALIDADES
    // ==========================================
    async createShiftType(data) {
        const db = this.getDb();
        const ref = db.collection(COLL_SHIFT_TYPES).doc();
        const newType = {
            ...data,
            id: ref.id,
        };
        await ref.set(newType);
        return newType;
    }
    async getShiftTypesByContract(contractId) {
        const snapshot = await this.getDb().collection(COLL_SHIFT_TYPES)
            .where('contractId', '==', contractId)
            .get();
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
};
exports.ClientService = ClientService;
exports.ClientService = ClientService = __decorate([
    (0, common_1.Injectable)()
], ClientService);
//# sourceMappingURL=client.service.js.map