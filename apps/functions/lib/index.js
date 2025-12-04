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
exports.checkSystemHealth = exports.manageSystemUsers = exports.manageAbsences = exports.manageEmployees = exports.manageHierarchy = exports.manageData = exports.auditShift = exports.scheduleShift = exports.createUser = void 0;
// 🛑 LÍNEA 1 OBLIGATORIA: Necesaria para que NestJS funcione en Cloud Functions
require("reflect-metadata");
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const main_1 = require("./main");
// Servicios del Sistema
const scheduling_service_1 = require("./scheduling/scheduling.service");
const auth_service_1 = require("./auth/auth.service");
const data_management_service_1 = require("./data-management/data-management.service");
const audit_service_1 = require("./scheduling/audit.service");
const client_service_1 = require("./data-management/client.service");
const employee_service_1 = require("./data-management/employee.service");
const system_user_service_1 = require("./data-management/system-user.service");
const absence_service_1 = require("./data-management/absence.service");
// Inicialización Segura de Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Cache del contexto de NestJS para optimizar arranque en caliente (Warm Starts)
let nestApp;
/**
 * Helper blindado para obtener servicios de NestJS dentro del contexto de Cloud Functions.
 * Captura y loguea errores de inicio para facilitar el diagnóstico.
 */
async function getService(service) {
    try {
        if (!nestApp) {
            console.log("⚙️ [Backend] Iniciando NestJS Context...");
            nestApp = await (0, main_1.createNestApp)();
            console.log("✅ [Backend] NestJS Context iniciado correctamente.");
        }
        return nestApp.get(service);
    }
    catch (error) {
        console.error("🔥 [Backend] ERROR FATAL AL INICIAR NESTJS (Boot Crash):", error);
        // Lanzamos un error que Firebase entienda y muestre en el cliente
        throw new functions.https.HttpsError('internal', 'Error crítico en el servidor al iniciar dependencias.');
    }
}
// Constantes de Seguridad (RBAC)
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];
const ALLOWED_ROLES = ['admin', 'employee'];
// =========================================================
// 1. GESTIÓN DE USUARIOS (AUTH)
// =========================================================
exports.createUser = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. Rol insuficiente.');
    }
    try {
        const authService = await getService(auth_service_1.AuthService);
        const { email, password, name, role: receivedRole } = data;
        if (!ALLOWED_ROLES.includes(receivedRole)) {
            throw new functions.https.HttpsError('invalid-argument', 'Rol inválido.');
        }
        const newEmployee = await authService.createEmployeeProfile(email, password, receivedRole, name);
        return { success: true, uid: newEmployee.uid };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[CREATE_USER_FATAL]', error);
        throw new functions.https.HttpsError('internal', 'Error al crear usuario.');
    }
});
// =========================================================
// 2. MOTOR DE AGENDAMIENTO (WFM)
// =========================================================
exports.scheduleShift = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    try {
        const schedulingService = await getService(scheduling_service_1.SchedulingService);
        const result = await schedulingService.assignShift(data, callerAuth.token);
        return { success: true, shiftId: result.id };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        // Captura de errores de negocio del WorkloadService
        if (error.message && (error.message.includes('BLOQUEO:') || error.message.includes('SOLAPAMIENTO DETECTADO:') || error.message.includes('LÍMITE EXCEDIDO:'))) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        console.error('[SCHEDULE_SHIFT_FATAL]', error);
        throw new functions.https.HttpsError('internal', `Error: ${error.message}`);
    }
});
// =========================================================
// 3. AUDITORÍA (GEOFENCING & CHECK-IN/OUT)
// =========================================================
exports.auditShift = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
    try {
        const auditService = await getService(audit_service_1.AuditService);
        const result = await auditService.auditShiftAction(data.shiftId, data.action, data.coords, context.auth.uid);
        return { success: true, newStatus: result.status };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[AUDIT_SHIFT_FATAL]', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =========================================================
// 4. GESTIÓN DE DATOS BÁSICOS
// =========================================================
exports.manageData = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const dmService = await getService(data_management_service_1.DataManagementService);
        switch (action) {
            case 'CREATE_OBJECTIVE': return { success: true, data: await dmService.createObjective(payload) };
            case 'GET_ALL_OBJECTIVES': return { success: true, data: await dmService.findAllObjectives(payload?.clientId) };
            case 'GET_CLIENT_BY_ID': return { success: true, data: await dmService.getClientById(payload.clientId) };
            default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[DATA_MANAGEMENT_FATAL]', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =========================================================
// 5. GESTIÓN DE JERARQUÍA COMERCIAL
// =========================================================
exports.manageHierarchy = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const clientService = await getService(client_service_1.ClientService);
        switch (action) {
            case 'CREATE_CLIENT': return { success: true, data: await clientService.createClient(payload) };
            case 'GET_CLIENT': return { success: true, data: await clientService.getClient(payload.id) };
            case 'GET_ALL_CLIENTS': return { success: true, data: await clientService.findAllClients() };
            case 'UPDATE_CLIENT':
                await clientService.updateClient(payload.id, payload.data);
                return { success: true, message: 'Cliente actualizado' };
            case 'DELETE_CLIENT':
                await clientService.deleteClient(payload.id);
                return { success: true, message: 'Cliente eliminado' };
            case 'CREATE_OBJECTIVE': return { success: true, data: await clientService.createObjective(payload) };
            case 'CREATE_CONTRACT': return { success: true, data: await clientService.createServiceContract(payload) };
            case 'CREATE_SHIFT_TYPE': return { success: true, data: await clientService.createShiftType(payload) };
            case 'GET_SHIFT_TYPES': return { success: true, data: await clientService.getShiftTypesByContract(payload.contractId) };
            default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error(`[HIERARCHY_ERROR] Action ${action} failed:`, error);
        throw new functions.https.HttpsError('internal', `Error: ${error.message}`);
    }
});
// =========================================================
// 6. GESTIÓN DE EMPLEADOS (RRHH)
// =========================================================
exports.manageEmployees = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const employeeService = await getService(employee_service_1.EmployeeService);
        switch (action) {
            case 'GET_ALL_EMPLOYEES':
                const employees = await employeeService.findAllEmployees(payload?.clientId);
                return { success: true, data: employees };
            case 'UPDATE_EMPLOYEE':
                await employeeService.updateEmployee(payload.uid, payload.data);
                return { success: true, message: 'Datos actualizados.' };
            case 'DELETE_EMPLOYEE':
                await employeeService.deleteEmployee(payload.uid);
                return { success: true, message: 'Empleado eliminado.' };
            default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error(`[EMPLOYEE_ERROR] Action ${action} failed:`, error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =========================================================
// 7. GESTIÓN DE AUSENCIAS (RRHH)
// =========================================================
exports.manageAbsences = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const absenceService = await getService(absence_service_1.AbsenceService);
        if (action === 'CREATE_ABSENCE') {
            const result = await absenceService.createAbsence(payload);
            return {
                success: true,
                message: 'Ausencia registrada exitosamente.',
                absenceId: result.id
            };
        }
        throw new functions.https.HttpsError('invalid-argument', 'Acción desconocida.');
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        if (error.message && (error.message.includes('Conflict:') || error.message.includes('SOLAPAMIENTO DETECTADO:'))) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        console.error(`[ABSENCE_ERROR] Action ${action} failed:`, error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =========================================================
// 8. GESTIÓN DE USUARIOS DEL SISTEMA
// =========================================================
exports.manageSystemUsers = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const sysUserService = await getService(system_user_service_1.SystemUserService);
        switch (action) {
            case 'CREATE_USER':
                await sysUserService.createSystemUser(payload);
                return { success: true, message: 'Admin creado.' };
            case 'GET_ALL_USERS':
                const users = await sysUserService.findAll();
                return { success: true, data: users };
            case 'UPDATE_USER':
                await sysUserService.updateSystemUser(payload.uid, payload.data);
                return { success: true, message: 'Admin actualizado.' };
            case 'DELETE_USER':
                await sysUserService.deleteSystemUser(payload.uid);
                return { success: true, message: 'Admin eliminado.' };
            default:
                throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[SYS_USER_ERROR]', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// =========================================================
// 9. DIAGNÓSTICO DE SISTEMA (HEALTH CHECK)
// =========================================================
exports.checkSystemHealth = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sin sesión.');
    const start = Date.now();
    let dbStatus = 'unknown';
    let dbLatency = 0;
    try {
        // Prueba de fuego a Firestore
        await admin.firestore().listCollections();
        const end = Date.now();
        dbLatency = end - start;
        dbStatus = 'connected';
    }
    catch (error) {
        console.error('[HEALTH_CHECK] DB Error:', error);
        dbStatus = 'disconnected';
        throw new functions.https.HttpsError('unavailable', 'Error conectando a la Base de Datos.');
    }
    return {
        serverTime: Date.now(),
        environment: process.env.FUNCTIONS_EMULATOR ? 'emulator' : 'production',
        nodeVersion: process.version,
        database: { status: dbStatus, latencyMs: dbLatency },
        memory: process.memoryUsage().heapUsed / 1024 / 1024
    };
});
//# sourceMappingURL=index.js.map