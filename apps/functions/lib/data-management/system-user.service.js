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
exports.SystemUserService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const COLL_SYSTEM_USERS = 'system_users';
let SystemUserService = class SystemUserService {
    constructor() {
        // Inicialización diferida
        this.getAuth = () => admin.app().auth();
        this.getDb = () => admin.app().firestore();
    }
    /**
     * Crea un nuevo usuario administrativo.
     */
    async createSystemUser(data) {
        const auth = this.getAuth();
        const db = this.getDb();
        // 1. Crear en Auth
        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.displayName,
            emailVerified: true,
        }).catch(error => {
            if (error.code === 'auth/email-already-exists')
                throw new common_1.ConflictException('El email ya está registrado.');
            throw new common_1.InternalServerErrorException('Error al crear usuario en Auth.');
        });
        // 2. Asignar Claims (Rol)
        // Nota: Agregamos un claim 'type: admin' para diferenciarlo de empleados
        await auth.setCustomUserClaims(userRecord.uid, { role: data.role, type: 'system_user' });
        // 3. Crear Perfil en Firestore
        const newUser = {
            uid: userRecord.uid,
            email: data.email,
            displayName: data.displayName,
            role: data.role,
            status: 'Active',
            createdAt: admin.firestore.Timestamp.now()
        };
        await db.collection(COLL_SYSTEM_USERS).doc(userRecord.uid).set(newUser);
        return newUser;
    }
    /**
     * Obtener todos los administradores.
     */
    async findAll() {
        const snapshot = await this.getDb().collection(COLL_SYSTEM_USERS).get();
        return snapshot.docs.map(doc => doc.data());
    }
    /**
     * Actualizar datos (Rol o Estado).
     */
    async updateSystemUser(uid, data) {
        const auth = this.getAuth();
        const db = this.getDb();
        // Si cambia el rol, actualizar Auth
        if (data.role) {
            await auth.setCustomUserClaims(uid, { role: data.role, type: 'system_user' });
        }
        // Si se desactiva, deshabilitar en Auth
        if (data.status) {
            await auth.updateUser(uid, { disabled: data.status === 'Inactive' });
        }
        // Actualizar Firestore
        const safeData = { ...data };
        delete safeData.uid;
        delete safeData.email; // No cambiamos email por aquí
        await db.collection(COLL_SYSTEM_USERS).doc(uid).update(safeData);
    }
    /**
     * Eliminar administrador.
     */
    async deleteSystemUser(uid) {
        await this.getAuth().deleteUser(uid);
        await this.getDb().collection(COLL_SYSTEM_USERS).doc(uid).delete();
    }
};
exports.SystemUserService = SystemUserService;
exports.SystemUserService = SystemUserService = __decorate([
    (0, common_1.Injectable)()
], SystemUserService);
//# sourceMappingURL=system-user.service.js.map