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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const EMPLOYEES_COLLECTION = 'empleados';
let AuthService = class AuthService {
    constructor() {
        // 🔑 Inicialización diferida (Lazy Loading) para evitar error 'app/no-app'
        this.getAuth = () => admin.app().auth();
        this.getDb = () => admin.app().firestore();
    }
    async createEmployeeProfile(email, password, role, name) {
        const authInstance = this.getAuth();
        // 1. Crear usuario en Auth
        const user = await authInstance.createUser({
            email,
            password,
            displayName: name,
            emailVerified: true,
        }).catch(error => {
            if (error.code === 'auth/email-already-exists') {
                throw new common_1.ConflictException('The email address is already in use.');
            }
            console.error('[AUTH_CREATE_ERROR]', error.message);
            throw new common_1.InternalServerErrorException('Failed to create user in Firebase Auth.');
        });
        const employeeUid = user.uid;
        // 2. Asignar Custom Claims (Rol)
        try {
            await authInstance.setCustomUserClaims(employeeUid, { role });
        }
        catch (error) {
            console.error(`[CLAIMS_ERROR] Failed to set claims.`, error);
            await authInstance.deleteUser(employeeUid);
            throw new common_1.InternalServerErrorException('Failed to assign role. Account creation aborted.');
        }
        // 3. Crear Perfil en Firestore
        // 🛑 FIX TS2739: Agregamos los nuevos campos obligatorios con valores por defecto
        const employeeProfile = {
            uid: employeeUid,
            email: email,
            name: name,
            role: role,
            isAvailable: true,
            maxHoursPerMonth: 176, // Valor estándar (Convenio)
            contractType: 'FullTime' // Valor estándar
        };
        const dbInstance = this.getDb();
        try {
            await dbInstance.collection(EMPLOYEES_COLLECTION).doc(employeeUid).set(employeeProfile);
        }
        catch (error) {
            console.error(`[FIRESTORE_ERROR] Failed to create profile.`, error);
            await authInstance.deleteUser(employeeUid);
            throw new common_1.InternalServerErrorException('Failed to save profile. Account creation aborted.');
        }
        return employeeProfile;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)()
], AuthService);
//# sourceMappingURL=auth.service.js.map