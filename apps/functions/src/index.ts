// 🛑 LÍNEA 1 OBLIGATORIA
import 'reflect-metadata'; 

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

// Inicialización
if (admin.apps.length === 0) {
  admin.initializeApp();
}

let nestApp: INestApplicationContext;

async function getService<T>(service: new (...args: any[]) => T): Promise<T> {
  try {
    if (!nestApp) {
      console.log("⚙️ [Backend] Iniciando NestJS Context...");
      nestApp = await createNestApp();
      console.log("✅ [Backend] NestJS Context iniciado.");
    }
    return nestApp.get<T>(service); 
  } catch (error) {
    console.error("🔥 [Backend] ERROR FATAL AL INICIAR NESTJS:", error);
    throw new functions.https.HttpsError('internal', 'Error crítico en el servidor.');
  }
}

const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];
const ALLOWED_ROLES: string[] = ['admin', 'employee']; 

// =========================================================
// 1. GESTIÓN DE USUARIOS (AUTH)
// =========================================================
// 🛑 FIX: Tipado explícito 'any' para evitar conflictos entre versiones de SDK
export const createUser = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;
  
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }

  try {
    const authService = await getService(AuthService);
    // Extracción segura de datos
    const email = data.email;
    const password = data.password;
    const name = data.name;
    const receivedRole = data.role;
    
    if (!ALLOWED_ROLES.includes(receivedRole)) {
        throw new functions.https.HttpsError('invalid-argument', 'Rol inválido.');
    }
    
    const newEmployee = await authService.createEmployeeProfile(email, password, receivedRole as EmployeeRole, name);
    return { success: true, uid: newEmployee.uid };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[CREATE_USER_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message || 'Error interno');
  }
});

// =========================================================
// 2. MOTOR DE AGENDAMIENTO (WFM)
// =========================================================
export const scheduleShift = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;

  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }

  try {
    const schedulingService = await getService(SchedulingService);
    // TypeScript puede quejarse si 'data' no coincide con IShift, forzamos 'any'
    const result = await schedulingService.assignShift(data, callerAuth.token);
    return { success: true, shiftId: result.id };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    if (error.message && (error.message.includes('BLOQUEO:') || error.message.includes('SOLAPAMIENTO'))) {
        throw new functions.https.HttpsError('failed-precondition', error.message);
    }
    console.error('[SCHEDULE_SHIFT_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 3. AUDITORÍA (GEOFENCING)
// =========================================================
export const auditShift = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');

  try {
    const auditService = await getService(AuditService);
    const result = await auditService.auditShiftAction(data.shiftId, data.action, data.coords, context.auth.uid);
    return { success: true, newStatus: result.status };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[AUDIT_SHIFT_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 4. GESTIÓN DE DATOS BÁSICOS
// =========================================================
export const manageData = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
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
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[MANAGE_DATA_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 5. GESTIÓN DE JERARQUÍA COMERCIAL
// =========================================================
export const manageHierarchy = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data;

  try {
    const clientService = await getService(ClientService);

    switch (action) {
      case 'CREATE_CLIENT': return { success: true, data: await clientService.createClient(payload) };
      case 'GET_CLIENT': return { success: true, data: await clientService.getClient(payload.id) };
      case 'GET_ALL_CLIENTS': return { success: true, data: await clientService.findAllClients() };
      case 'UPDATE_CLIENT': await clientService.updateClient(payload.id, payload.data); return { success: true, message: 'Actualizado' };
      case 'DELETE_CLIENT': await clientService.deleteClient(payload.id); return { success: true, message: 'Eliminado' };
      case 'CREATE_OBJECTIVE': return { success: true, data: await clientService.createObjective(payload) };
      case 'CREATE_CONTRACT': return { success: true, data: await clientService.createServiceContract(payload) };
      case 'CREATE_SHIFT_TYPE': return { success: true, data: await clientService.createShiftType(payload) };
      case 'GET_SHIFT_TYPES': return { success: true, data: await clientService.getShiftTypesByContract(payload.contractId) };
      default: throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
    }
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[HIERARCHY_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 6. GESTIÓN DE EMPLEADOS
// =========================================================
export const manageEmployees = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data;
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
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[EMPLOYEE_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 7. GESTIÓN DE AUSENCIAS
// =========================================================
export const manageAbsences = functions.https.onCall(async (data: any, context: any) => {
    const callerAuth = context.auth;
    if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
    }

    const { action, payload } = data;

    try {
        const absenceService = await getService(AbsenceService);

        if (action === 'CREATE_ABSENCE') {
            const result = await absenceService.createAbsence(payload);
            return { 
                success: true, 
                message: 'Ausencia registrada.',
                absenceId: result.id
            };
        }
        
        throw new functions.https.HttpsError('invalid-argument', 'Acción desconocida.');

    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) throw error;
        if (error.message && (error.message.includes('Conflict:') || error.message.includes('SOLAPAMIENTO'))) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        console.error('[ABSENCE_ERROR]', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// =========================================================
// 8. GESTIÓN DE USUARIOS DEL SISTEMA
// =========================================================
export const manageSystemUsers = functions.https.onCall(async (data: any, context: any) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }
  
  const { action, payload } = data;

  try {
    const sysUserService = await getService(SystemUserService);

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
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[SYS_USER_ERROR]', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});