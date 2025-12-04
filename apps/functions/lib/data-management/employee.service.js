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
exports.EmployeeService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const COLL_EMPLOYEES = 'empleados';
let EmployeeService = class EmployeeService {
    constructor() {
        // Inicialización diferida para evitar errores de 'app/no-app'
        this.getDb = () => admin.app().firestore();
        this.getAuth = () => admin.app().auth();
    }
    /**
     * Obtiene todos los empleados registrados.
     */
    async findAllEmployees() {
        try {
            const snapshot = await this.getDb().collection(COLL_EMPLOYEES).get();
            return snapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            console.error('[GET_EMPLOYEES_ERROR]', error);
            throw new common_1.InternalServerErrorException('Error al obtener la lista de empleados.');
        }
    }
    /**
     * Actualiza los datos de un empleado (Ej: cambiar límite de horas o rol).
     */
    async updateEmployee(uid, data) {
        const db = this.getDb();
        const auth = this.getAuth();
        // 1. Actualizar en Firestore
        const ref = db.collection(COLL_EMPLOYEES).doc(uid);
        const doc = await ref.get();
        if (!doc.exists) {
            throw new common_1.NotFoundException('Empleado no encontrado.');
        }
        // Protegemos campos inmutables
        delete data.uid;
        delete data.email;
        await ref.update(data);
        // 2. Si cambió el rol, actualizar Custom Claims en Auth
        if (data.role) {
            try {
                await auth.setCustomUserClaims(uid, { role: data.role });
            }
            catch (e) {
                console.error(`Error actualizando claims para ${uid}`, e);
                // No fallamos todo el proceso, pero logueamos el error
            }
        }
    }
    /**
     * Elimina un empleado (Firestore + Auth).
     */
    async deleteEmployee(uid) {
        try {
            // 1. Borrar de Auth (Impide nuevo login)
            await this.getAuth().deleteUser(uid);
            // 2. Borrar de Firestore (Opcional: Podrías solo marcarlo como inactivo)
            await this.getDb().collection(COLL_EMPLOYEES).doc(uid).delete();
        }
        catch (error) {
            console.error('[DELETE_EMPLOYEE_ERROR]', error);
            throw new common_1.InternalServerErrorException('Error al eliminar el empleado.');
        }
    }
};
exports.EmployeeService = EmployeeService;
exports.EmployeeService = EmployeeService = __decorate([
    (0, common_1.Injectable)()
], EmployeeService);
//# sourceMappingURL=employee.service.js.map