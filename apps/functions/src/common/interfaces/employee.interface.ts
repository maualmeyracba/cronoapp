import * as admin from 'firebase-admin'; // 🛑 SDK SERVIDOR

/**
 * @description Define los roles de usuario dentro del sistema.
 */
export type EmployeeRole = 'admin' | 'employee';

/**
 * @description Define los tipos de contrato laboral soportados.
 */
export type ContractType = 'FullTime' | 'PartTime' | 'Eventual';

/**
 * @description Interfaz de Colaborador (Versión Backend).
 * Se utiliza para validar datos y tipar retornos en Cloud Functions.
 */
export interface IEmployee {
  uid: string;
  name: string;
  role: EmployeeRole;
  email: string;
  
  isAvailable: boolean;
  maxHoursPerMonth: number;
  contractType: ContractType;

  // 🛑 CAMBIO ARQUITECTÓNICO: Pool de Recursos
  clientId?: string;       // Opcional en el backend
  businessUnitId?: string; // Nuevo campo para multi-tenancy

  dni: string;        
  fileNumber: string;
  address: string;    
  phone?: string;     
}

/**
 * @description Estructura de una ausencia en base de datos.
 * Usa admin.firestore.Timestamp para compatibilidad con Node.js.
 */
export interface IAbsence {
    id: string;
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    startDate: admin.firestore.Timestamp; 
    endDate: admin.firestore.Timestamp;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: admin.firestore.Timestamp;
}

/**
 * @description Payload recibido en las Cloud Functions.
 * Puede recibir Dates o Timestamps serializados, por lo que es flexible.
 */
export interface IAbsencePayload {
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    // Flexible para aceptar lo que envíe el front (Date, string ISO o Timestamp)
    startDate: admin.firestore.Timestamp | Date | string; 
    endDate: admin.firestore.Timestamp | Date | string;
    reason: string;
}