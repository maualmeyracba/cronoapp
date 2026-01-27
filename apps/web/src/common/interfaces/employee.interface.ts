import { Timestamp } from 'firebase/firestore'; 
// NOTA: En el backend (functions) cambia esta línea por: import * as admin from 'firebase-admin'; y usa admin.firestore.Timestamp

/**
 * @description Define los roles de usuario dentro del sistema.
 */
export type EmployeeRole = 'admin' | 'employee';

/**
 * @description Define los tipos de contrato laboral soportados.
 */
export type ContractType = 'FullTime' | 'PartTime' | 'Eventual';

/**
 * 🛑 NUEVO: Convenios Colectivos soportados para reglas de negocio.
 */
export type LaborAgreement = 'SUVICO' | 'COMERCIO' | 'UOCRA' | 'FUERA_CONVENIO';

/**
 * @description Interfaz principal para la entidad Colaborador (Employee).
 */
export interface IEmployee {
    uid: string; // Firebase Auth UID / Document ID
    name: string;
    role: EmployeeRole;
    email: string;
    
    // Estado de disponibilidad general
    isAvailable: boolean;
    
    // Configuración Laboral
    maxHoursPerMonth: number; // Límite de horas contractuales (Soft Block)
    contractType: ContractType;
    
    // 🛑 NUEVO CAMPO: Convenio Colectivo
    laborAgreement: LaborAgreement; 

    // Campos para el Ciclo de Nómina (RRHH)
    payrollCycleStartDay?: number; // Día del mes en que comienza el ciclo (Ej: 15)
    payrollCycleEndDay?: number;   // Día del mes en que finaliza el ciclo (Ej: 14)
    
    // Ubicación Organizacional
    clientId?: string;       // Cliente asignado actualmente (Opcional)
    businessUnitId?: string; // Unidad de Negocio

    // Datos Personales
    dni: string; 
    fileNumber: string; // Legajo
    address: string; 
    phone?: string;     
}

export interface IAbsence {
    id: string;
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    startDate: any; // Timestamp o Date
    endDate: any;   // Timestamp o Date
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: any;
}

export interface IAbsencePayload {
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    startDate: Date; 
    endDate: Date;
    reason: string;
}



