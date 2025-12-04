// 👇 CORRECCIÓN: Usar 'firebase-admin/firestore' en el backend
import { Timestamp } from 'firebase-admin/firestore'; 

export type EmployeeRole = 'admin' | 'employee';
export type ContractType = 'FullTime' | 'PartTime' | 'Eventual';

export interface IEmployee {
  uid: string;
  name: string;
  role: EmployeeRole;
  email: string;
  isAvailable: boolean;
  maxHoursPerMonth: number;
  contractType: ContractType;
    
    // 👇 AGREGAMOS ESTOS CAMPOS PARA QUE DESAPAREZCAN LOS ERRORES ROJOS
    clientId: string;   
    dni: string;        
    fileNumber: string; 
    address: string;    
    phone?: string;     
}

// Interfaces auxiliares (Déjalas si ya las tienes, o agrégalas si faltan)
export interface IAbsence {
    id: string;
    employeeId: string;
    employeeName: string;
    clientId: string;
    type: 'VACATION' | 'SICK_LEAVE' | 'OTHER';
    startDate: Timestamp; 
    endDate: Timestamp;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Timestamp;
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