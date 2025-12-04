// 🛑 IMPORTACIÓN OBLIGATORIA
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
import { EmployeeRole } from './common/interfaces/employee.interface';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

let nestApp: INestApplicationContext;

async function getService<T>(service: new (...args: any[]) => T): Promise<T> {
  try {
    if (!nestApp) nestApp = await createNestApp();
    return nestApp.get<T>(service); 
  } catch (error) {
    console.error("🔥 [Backend] ERROR FATAL AL INICIAR NESTJS:", error);
    throw new functions.https.HttpsError('internal', 'Error crítico de inicio.');
  }
}

const ADMIN_ROLES = ['admin', 'SuperAdmin', 'Scheduler', 'HR_Manager'];
const ALLOWED_ROLES: any[] = ['admin', 'employee']; 

// ... (Funciones 1 a 5: createUser, scheduleShift, auditShift, manageData, manageHierarchy se mantienen igual) ...
// NOTA: Asegúrate de mantener las funciones anteriores aquí.

// =========================================================
// 6. GESTIÓN DE EMPLEADOS (RRHH)
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
        // 🛑 AHORA FUNCIONARÁ PORQUE ACTUALIZAMOS EL SERVICIO
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
    console.error(`[EMPLOYEE_ERROR] Action ${action} failed:`, error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ... (Funciones 7 y 8: manageAbsences y manageSystemUsers se mantienen igual) ...
// Asegúrate de mantener manageAbsences y checkSystemHealth aquí.