"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSystemHealth = exports.managePatterns = exports.manageAbsences = exports.manageSystemUsers = exports.manageEmployees = exports.manageHierarchy = exports.manageData = exports.auditShift = exports.manageShifts = exports.scheduleShift = exports.createUser = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const main_1 = require("./main");
const scheduling_service_1 = require("./scheduling/scheduling.service");
const auth_service_1 = require("./auth/auth.service");
const data_management_service_1 = require("./data-management/data-management.service");
const audit_service_1 = require("./scheduling/audit.service");
const client_service_1 = require("./data-management/client.service");
const employee_service_1 = require("./data-management/employee.service");
const system_user_service_1 = require("./data-management/system-user.service");
const absence_service_1 = require("./data-management/absence.service");
const pattern_service_1 = require("./scheduling/pattern.service");
if (!admin.apps.length) {
    admin.initializeApp();
}
let nestApp;
async function getService(service) {
    if (!nestApp) {
        nestApp = await (0, main_1.createNestApp)();
    }
    return nestApp.get(service);
}
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager', 'Manager', 'Operator', 'Supervisor'];
const ALLOWED_ROLES = ['admin', 'employee'];
exports.createUser = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. Rol insuficiente.');
    }
    try {
        const authService = await getService(auth_service_1.AuthService);
        const { email, password, name, role: receivedRole, clientId, dni, fileNumber, address } = data;
        if (!ALLOWED_ROLES.includes(receivedRole)) {
            throw new functions.https.HttpsError('invalid-argument', 'Rol inválido.');
        }
        const validRole = receivedRole;
        const newEmployee = await authService.createEmployeeProfile(email, password, validRole, name, { clientId: clientId || '', dni, fileNumber, address });
        return { success: true, uid: newEmployee.uid };
    }
    catch (error) {
        const err = error;
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[CREATE_USER_FATAL]', err.message);
        throw new functions.https.HttpsError('internal', 'Error al crear usuario.');
    }
});
exports.scheduleShift = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. Rol insuficiente.');
    }
    try {
        const schedulingService = await getService(scheduling_service_1.SchedulingService);
        const result = await schedulingService.assignShift(data, callerAuth.token);
        return { success: true, shiftId: result.id };
    }
    catch (error) {
        const err = error;
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[SCHEDULE_SHIFT_FATAL]', err.message);
        throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
    }
});
exports.manageShifts = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    const ALLOWED_PLANNING_ROLES = ['admin', 'SuperAdmin', 'Manager', 'Scheduler'];
    if (!callerAuth || !ALLOWED_PLANNING_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const schedulingService = await getService(scheduling_service_1.SchedulingService);
        switch (action) {
            case 'UPDATE_SHIFT':
                await schedulingService.updateShift(payload.id, payload.data);
                return { success: true, message: 'Turno actualizado.' };
            case 'DELETE_SHIFT':
                await schedulingService.deleteShift(payload.id);
                return { success: true, message: 'Turno eliminado.' };
            case 'REPLICATE_STRUCTURE':
                if (!payload.objectiveId || !payload.sourceDate || !payload.targetStartDate || !payload.targetEndDate) {
                    throw new functions.https.HttpsError('invalid-argument', 'Faltan fechas para replicar.');
                }
                const result = await schedulingService.replicateDailyStructure(payload.objectiveId, payload.sourceDate, payload.targetStartDate, payload.targetEndDate, callerAuth.uid);
                return {
                    success: true,
                    data: result,
                    message: `Replicado: ${result.created} turnos. (Omitidos: ${result.skipped} días)`
                };
            default:
                throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        const err = error;
        console.error(`[SHIFT_ERROR] Action ${action} failed:`, err.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', err.message);
    }
});
exports.auditShift = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
    const { shiftId, action, coords, isManualOverride } = data;
    try {
        const auditService = await getService(audit_service_1.AuditService);
        const result = await auditService.auditShiftAction(shiftId, action, coords || null, context.auth.uid, context.auth.token.role, isManualOverride || false);
        return { success: true, newStatus: result.status };
    }
    catch (error) {
        const err = error;
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[AUDIT_SHIFT_FATAL]', err.message);
        throw new functions.https.HttpsError('internal', err.message);
    }
});
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
        const err = error;
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('[DATA_MANAGEMENT_FATAL]', err.message);
        throw new functions.https.HttpsError('internal', err.message);
    }
});
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
            case 'UPDATE_OBJECTIVE':
                await clientService.updateObjective(payload.id, payload.data);
                return { success: true, message: 'Objetivo actualizado correctamente' };
            case 'CREATE_CONTRACT': return { success: true, data: await clientService.createServiceContract(payload) };
            case 'UPDATE_CONTRACT':
                await clientService.updateServiceContract(payload.id, payload.data);
                return { success: true, message: 'Servicio actualizado' };
            case 'DELETE_CONTRACT':
                await clientService.deleteServiceContract(payload.id);
                return { success: true, message: 'Servicio eliminado' };
            case 'CREATE_SHIFT_TYPE': return { success: true, data: await clientService.createShiftType(payload) };
            case 'GET_SHIFT_TYPES': return { success: true, data: await clientService.getShiftTypesByContract(payload.contractId) };
            case 'UPDATE_SHIFT_TYPE':
                await clientService.updateShiftType(payload.id, payload.data);
                return { success: true, message: 'Modalidad actualizada' };
            case 'DELETE_SHIFT_TYPE':
                await clientService.deleteShiftType(payload.id);
                return { success: true, message: 'Modalidad eliminada' };
            default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        const err = error;
        console.error(`[HIERARCHY_ERROR] Action ${action} failed:`, err.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
    }
});
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
        const err = error;
        console.error(`[EMPLOYEE_ERROR] Action ${action} failed:`, err.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', err.message);
    }
});
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
                return { success: true, message: 'Administrador creado exitosamente.' };
            case 'GET_ALL_USERS':
                const users = await sysUserService.findAll();
                return { success: true, data: users };
            case 'UPDATE_USER':
                await sysUserService.updateSystemUser(payload.uid, payload.data);
                return { success: true, message: 'Administrador actualizado.' };
            case 'DELETE_USER':
                await sysUserService.deleteSystemUser(payload.uid);
                return { success: true, message: 'Administrador eliminado.' };
            default:
                throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        const err = error;
        console.error(`[SYS_USER_ERROR] ${action} failed:`, err.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', err.message);
    }
});
exports.manageAbsences = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth) {
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
    }
    const { action, payload } = data;
    const isAdmin = ADMIN_ROLES.includes(callerAuth.token.role);
    const isSelf = payload.employeeId === callerAuth.uid;
    if (!isAdmin && !(isSelf && action === 'CREATE_ABSENCE')) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    try {
        const absenceService = await getService(absence_service_1.AbsenceService);
        switch (action) {
            case 'CREATE_ABSENCE':
                return { success: true, data: await absenceService.createAbsence(payload) };
            default:
                throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        }
    }
    catch (error) {
        const err = error;
        console.error(`[ABSENCE_ERROR] Action ${action} failed:`, err.message);
        if (error instanceof functions.https.HttpsError)
            throw error;
        if (err.message.includes('Conflict')) {
            throw new functions.https.HttpsError('failed-precondition', err.message);
        }
        throw new functions.https.HttpsError('internal', err.message);
    }
});
exports.managePatterns = functions.https.onCall(async (data, context) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }
    const { action, payload } = data;
    try {
        const patternService = await getService(pattern_service_1.PatternService);
        switch (action) {
            case 'CREATE_PATTERN': return patternService.createPattern(payload, callerAuth.uid);
            case 'GET_PATTERNS': return patternService.getPatternsByContract(payload.contractId);
            case 'DELETE_PATTERN':
                await patternService.deletePattern(payload.id);
                return { success: true };
            case 'GENERATE_VACANCIES':
                return patternService.generateVacancies(payload.contractId, payload.month, payload.year, payload.objectiveId);
            default: throw new functions.https.HttpsError('invalid-argument', 'Acción inválida');
        }
    }
    catch (error) {
        console.error(`[PATTERN_ERROR] Action ${action} failed:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.checkSystemHealth = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
    }
    const start = Date.now();
    try {
        await admin.firestore().listCollections();
        const end = Date.now();
        return {
            status: 'ok',
            nodeVersion: process.version,
            database: {
                status: 'connected',
                latencyMs: end - start
            }
        };
    }
    catch (error) {
        console.error('[HEALTH_CHECK_ERROR]', error);
        return {
            status: 'error',
            nodeVersion: process.version,
            database: {
                status: 'disconnected',
                latencyMs: -1,
                error: error.message
            }
        };
    }
});
//# sourceMappingURL=index.js.map