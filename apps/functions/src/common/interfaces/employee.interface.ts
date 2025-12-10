import * as admin from 'firebase-admin';
// 🛑 SDK SERVIDOR

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
 */
export interface IEmployee {
  uid: string;
  name: string;
  role: EmployeeRole;
  email: string;
  
  isAvailable: boolean;
  maxHoursPerMonth: number;
  contractType: ContractType;
  
  // 🛑 FIX CRÍTICO: Campos para el Ciclo de Nómina
  payrollCycleStartDay?: number; // Día del mes en que comienza el ciclo (Ej: 15)
  payrollCycleEndDay?: number;   // Día del mes en que finaliza el ciclo (Ej: 14)
  
  clientId?: string;
  businessUnitId?: string;

  dni: string;        
  fileNumber: string;
  address: string;    
  phone?: string;
}

/**
 * @description Estructura de una ausencia en base de datos.
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
 */
export interface IAbsencePayload {
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    startDate: admin.firestore.Timestamp | Date | string; 
    endDate: admin.firestore.Timestamp | Date | string;
    reason: string;
}