import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createNestApp } from './main';
import { INestApplicationContext } from '@nestjs/common';

// Servicios
import { SchedulingService } from './scheduling/scheduling.service';
import { AuthService } from './auth/auth.service';
import { DataManagementService } from './data-management/data-management.service';
import { AuditService } from './scheduling/audit.service';
import { ClientService } from './data-management/client.service';
import { EmployeeService } from './data-management/employee.service';
import { SystemUserService } from './data-management/system-user.service';
import { AbsenceService } from './data-management/absence.service';

// Interfaces
import { EmployeeRole } from './common/interfaces/employee.interface';

// Inicialización de Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Singleton para la App de NestJS (Contexto de Inyección de Dependencias)
let nestApp: INestApplicationContext;

async function getService<T>(service: new (...args: any[]) => T): Promise<T> {
  if (!nestApp) {
    nestApp = await createNestApp();
  }
  return nestApp.get<T>(service); 
}

// Constantes de Roles
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];
const ALLOWED_ROLES: EmployeeRole[] = ['admin', 'employee'];

// =========================================================
// 1. GESTIÓN DE USUARIOS (AUTH)
// =========================================================
export const createUser = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. Rol insuficiente.');
  }

  try {
    const authService = await getService(AuthService);
    const { email, password, name, role: receivedRole, clientId, dni, fileNumber, address } = data;
    
    if (!ALLOWED_ROLES.includes(receivedRole as EmployeeRole)) {
       throw new functions.https.HttpsError('invalid-argument', 'Rol inválido.');
    }
    
    // Validación básica: El clientId es obligatorio para multi-tenancy
    if (!clientId) {
        throw new functions.https.HttpsError('invalid-argument', 'El ID de la empresa (clientId) es obligatorio.');
    }

    const validRole = receivedRole as EmployeeRole;

    const newEmployee = await authService.createEmployeeProfile(
        email, 
        password, 
        validRole, 
        name,
        { clientId, dni, fileNumber, address }
    );
    return { success: true, uid: newEmployee.uid };
  } catch (error: any) {
    const err = error as Error;
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[CREATE_USER_FATAL]', err.message);
    throw new functions.https.HttpsError('internal', 'Error al crear usuario.');
  }
});

// =========================================================
// 2. MOTOR DE AGENDAMIENTO
// =========================================================
export const scheduleShift = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. Rol insuficiente.');
  }

  try {
    const schedulingService = await getService(SchedulingService);
    const result = await schedulingService.assignShift(data, callerAuth.token);
    return { success: true, shiftId: result.id };
  } catch (error: any) {
    const err = error as Error;
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[SCHEDULE_SHIFT_FATAL]', err.message);
    throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
  }
});

// =========================================================
// 3. AUDITORÍA (GEOFENCING)
// =========================================================
export const auditShift = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');

  try {
    const auditService = await getService(AuditService);
    const result = await auditService.auditShiftAction(data.shiftId, data.action, data.coords, context.auth.uid);
    return { success: true, newStatus: result.status };
  } catch (error: any) {
    const err = error as Error;
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[AUDIT_SHIFT_FATAL]', err.message);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 4. GESTIÓN DE DATOS BÁSICOS
// =========================================================
export const manageData = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }

  const { action, payload } = data;
  try {
    const dmService = await getService(DataManagementService);
    switch (action) {
      case 'CREATE_OBJECTIVE': return { success: true, data: await dmService.createObjective(payload) };
      case 'GET_ALL_OBJECTIVES': return { success: true, data: await dmService.findAllObjectives(payload?.clientId) };
      case 'GET_CLIENT_BY_ID': return { success: true, data: await dmService.getClientById(payload.clientId) };
      default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
    }
  } catch (error: any) {
    const err = error as Error;
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[DATA_MANAGEMENT_FATAL]', err.message);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 5. GESTIÓN DE JERARQUÍA COMERCIAL
// =========================================================
export const manageHierarchy = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data as { action: string, payload: any };

  try {
    const clientService = await getService(ClientService);

    switch (action) {
      case 'CREATE_CLIENT': return { success: true, data: await clientService.createClient(payload) };
      case 'GET_CLIENT': return { success: true, data: await clientService.getClient(payload.id) };
      case 'GET_ALL_CLIENTS': return { success: true, data: await clientService.findAllClients() };
      case 'UPDATE_CLIENT': await clientService.updateClient(payload.id, payload.data);
          return { success: true, message: 'Cliente actualizado' };
      case 'DELETE_CLIENT': await clientService.deleteClient(payload.id); return { success: true, message: 'Cliente eliminado' };
      case 'CREATE_OBJECTIVE': return { success: true, data: await clientService.createObjective(payload) };
      case 'CREATE_CONTRACT': return { success: true, data: await clientService.createServiceContract(payload) };
      case 'CREATE_SHIFT_TYPE': return { success: true, data: await clientService.createShiftType(payload) };
      case 'GET_SHIFT_TYPES': return { success: true, data: await clientService.getShiftTypesByContract(payload.contractId) };
      default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
    }
  } catch (error: any) {
    const err = error as Error;
    console.error(`[HIERARCHY_ERROR] Action ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
  }
});

// =========================================================
// 6. GESTIÓN DE EMPLEADOS (RRHH)
// =========================================================
export const manageEmployees = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data as { action: string, payload: any };
  try {
    const employeeService = await getService(EmployeeService);
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
  } catch (error: any) {
    const err = error as Error;
    console.error(`[EMPLOYEE_ERROR] Action ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 7. GESTIÓN DE USUARIOS DEL SISTEMA (ADMINS)
// =========================================================
export const manageSystemUsers = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data as { action: string, payload: any };

  try {
    const sysUserService = await getService(SystemUserService);

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
  } catch (error: any) {
    const err = error as Error;
    console.error(`[SYS_USER_ERROR] ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 8. GESTIÓN DE NOVEDADES (AUSENCIAS)
// =========================================================
export const manageAbsences = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth) {
    throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
  }

  const { action, payload } = data as { action: string, payload: any };

  // 🛑 FIX DE SEGURIDAD PARA SELF-REPORTING:
  // Se permite si es Admin, O SI el empleado está reportando su propia ausencia.
  const isAdmin = ADMIN_ROLES.includes(callerAuth.token.role as string);
  const isSelf = payload.employeeId === callerAuth.uid;

  if (!isAdmin && !(isSelf && action === 'CREATE_ABSENCE')) {
      throw new functions.https.HttpsError('permission-denied', 'Acceso denegado. No puede reportar ausencias para otros.');
  }

  try {
    const absenceService = await getService(AbsenceService);

    switch (action) {
      case 'CREATE_ABSENCE':
        return { success: true, data: await absenceService.createAbsence(payload) };
      default:
        throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
    }
  } catch (error: any) {
    const err = error as Error;
    console.error(`[ABSENCE_ERROR] Action ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    if (err.message.includes('Conflict')) {
        throw new functions.https.HttpsError('failed-precondition', err.message);
    }
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 9. DIAGNÓSTICO DE SISTEMA (HEALTH CHECK)
// =========================================================
export const checkSystemHealth = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
  }

  const start = Date.now();
  try {
    // Prueba de latencia con Firestore (listCollections es ligero)
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
  } catch (error: any) {
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