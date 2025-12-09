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
import { PatternService } from './scheduling/pattern.service';

// Interfaces
import { EmployeeRole } from './common/interfaces/employee.interface';

// Inicialización
if (!admin.apps.length) {
  admin.initializeApp();
}

let nestApp: INestApplicationContext;

async function getService<T>(service: new (...args: any[]) => T): Promise<T> {
  if (!nestApp) {
    nestApp = await createNestApp();
  }
  return nestApp.get<T>(service); 
}

// Roles Administrativos
const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager', 'Manager', 'Operator', 'Supervisor'];
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

    const validRole = receivedRole as EmployeeRole;

    const newEmployee = await authService.createEmployeeProfile(
        email, 
        password, 
        validRole, 
        name,
        { clientId: clientId || '', dni, fileNumber, address }
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
// 2. MOTOR DE AGENDAMIENTO (CREAR TURNOS INDIVIDUALES)
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
// 3. GESTIÓN DE TURNOS (EDITAR / ELIMINAR / REPLICAR)
// =========================================================
export const manageShifts = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  // Permitimos roles de planificación
  const ALLOWED_PLANNING_ROLES = ['admin', 'SuperAdmin', 'Manager', 'Scheduler'];

  if (!callerAuth || !ALLOWED_PLANNING_ROLES.includes(callerAuth.token.role as string)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }

  const { action, payload } = data as { action: string, payload: any };

  try {
    const schedulingService = await getService(SchedulingService);

    switch (action) {
      case 'UPDATE_SHIFT':
        await schedulingService.updateShift(payload.id, payload.data);
        return { success: true, message: 'Turno actualizado.' };
      
      case 'DELETE_SHIFT':
        await schedulingService.deleteShift(payload.id);
        return { success: true, message: 'Turno eliminado.' };
      
      // 🛑 REPLICACIÓN MASIVA (Clonar estructura)
      case 'REPLICATE_STRUCTURE':
        if (!payload.objectiveId || !payload.sourceDate || !payload.targetStartDate || !payload.targetEndDate) {
            throw new functions.https.HttpsError('invalid-argument', 'Faltan fechas para replicar.');
        }
        const result = await schedulingService.replicateDailyStructure(
            payload.objectiveId,
            payload.sourceDate,
            payload.targetStartDate,
            payload.targetEndDate,
            callerAuth.uid
        );
        return { 
            success: true, 
            data: result, 
            message: `Replicado: ${result.created} turnos. (Omitidos: ${result.skipped} días)` 
        };

      default:
        throw new functions.https.HttpsError('invalid-argument', `Acción desconocida: ${action}`);
    }
  } catch (error: any) {
    const err = error as Error;
    console.error(`[SHIFT_ERROR] Action ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 4. AUDITORÍA (GEOFENCING & MANUAL OVERRIDE)
// =========================================================
export const auditShift = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');

  const { shiftId, action, coords, isManualOverride } = data;

  try {
    const auditService = await getService(AuditService);
    
    const result = await auditService.auditShiftAction(
        shiftId, 
        action, 
        coords || null, 
        context.auth.uid,
        context.auth.token.role as string, // Rol del token
        isManualOverride || false          // Bandera manual
    );
    
    return { success: true, newStatus: result.status };
  } catch (error: any) {
    const err = error as Error;
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[AUDIT_SHIFT_FATAL]', err.message);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// =========================================================
// 5. GESTIÓN DE DATOS BÁSICOS
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
// 6. GESTIÓN DE JERARQUÍA COMERCIAL
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
      // Clientes
      case 'CREATE_CLIENT': return { success: true, data: await clientService.createClient(payload) };
      case 'GET_CLIENT': return { success: true, data: await clientService.getClient(payload.id) };
      case 'GET_ALL_CLIENTS': return { success: true, data: await clientService.findAllClients() };
      case 'UPDATE_CLIENT': await clientService.updateClient(payload.id, payload.data);
          return { success: true, message: 'Cliente actualizado' };
      case 'DELETE_CLIENT': await clientService.deleteClient(payload.id); return { success: true, message: 'Cliente eliminado' };

      // Objetivos (Edición/Borrado)
      case 'CREATE_OBJECTIVE': return { success: true, data: await clientService.createObjective(payload) };
      case 'UPDATE_OBJECTIVE': 
          await clientService.updateObjective(payload.id, payload.data);
          return { success: true, message: 'Objetivo actualizado correctamente' };
      
      // Contratos (Servicios)
      case 'CREATE_CONTRACT': return { success: true, data: await clientService.createServiceContract(payload) };
      case 'UPDATE_CONTRACT': 
          await clientService.updateServiceContract(payload.id, payload.data);
          return { success: true, message: 'Servicio actualizado' };
      case 'DELETE_CONTRACT': 
          await clientService.deleteServiceContract(payload.id);
          return { success: true, message: 'Servicio eliminado' };

      // Modalidades (Tipos de Turno)
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
  } catch (error: any) {
    const err = error as Error;
    console.error(`[HIERARCHY_ERROR] Action ${action} failed:`, err.message);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
  }
});

// =========================================================
// 7. GESTIÓN DE EMPLEADOS (RRHH)
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
// 8. GESTIÓN DE USUARIOS DEL SISTEMA (ADMINS)
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
// 9. GESTIÓN DE NOVEDADES (AUSENCIAS)
// =========================================================
export const manageAbsences = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth) {
    throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación.');
  }

  const { action, payload } = data as { action: string, payload: any };

  const isAdmin = ADMIN_ROLES.includes(callerAuth.token.role as string);
  const isSelf = payload.employeeId === callerAuth.uid;

  if (!isAdmin && !(isSelf && action === 'CREATE_ABSENCE')) {
      throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
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
// 10. GESTIÓN DE PATRONES DE SERVICIO (AUTOMATIZACIÓN)
// =========================================================
export const managePatterns = functions.https.onCall(async (data, context) => {
  const callerAuth = context.auth;
  if (!callerAuth || !ADMIN_ROLES.includes(callerAuth.token.role as string)) {
      throw new functions.https.HttpsError('permission-denied', 'Acceso denegado.');
  }

  const { action, payload } = data as { action: string, payload: any };

  try {
    const patternService = await getService(PatternService);

    switch(action) {
        case 'CREATE_PATTERN': 
            return patternService.createPattern(payload, callerAuth.uid);
        
        case 'GET_PATTERNS': 
            return patternService.getPatternsByContract(payload.contractId);
        
        case 'DELETE_PATTERN': 
            await patternService.deletePattern(payload.id); 
            return { success: true };
        
        // Generar estructura (Crear vacantes)
        case 'GENERATE_VACANCIES': 
            return patternService.generateVacancies(
                payload.contractId, 
                payload.month, 
                payload.year, 
                payload.objectiveId 
            );
        
        // 🛑 NUEVO: Borrar estructura (Eliminar vacantes)
        case 'CLEAR_VACANCIES':
            return patternService.clearVacancies(
                payload.objectiveId,
                payload.month,
                payload.year
            );

        default: throw new functions.https.HttpsError('invalid-argument', 'Acción inválida');
    }
  } catch (error: any) {
      console.error(`[PATTERN_ERROR] Action ${action} failed:`, error.message);
      throw new functions.https.HttpsError('internal', error.message);
  }
});

// =========================================================
// 11. DIAGNÓSTICO DE SISTEMA (HEALTH CHECK)
// =========================================================
export const checkSystemHealth = functions.https.onCall(async (data, context) => {
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