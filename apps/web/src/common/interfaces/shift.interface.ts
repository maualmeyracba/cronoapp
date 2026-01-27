import { Timestamp } from 'firebase/firestore';

/**
 * @file shift.interface.ts
 * @description Definición de la estructura de un Turno (Shift) compartido entre Frontend y Backend.
 */

// Definimos un tipo flexible para las fechas para soportar:
// 1. admin.firestore.Timestamp (Backend)
// 2. firebase.firestore.Timestamp (Frontend SDK)
// 3. Date (Objetos JS nativos tras conversión)
// 4. { seconds: number, nanoseconds: number } (JSON serializado)
export type FirestoreDate = any;

export type ShiftStatus = 'Assigned' | 'Confirmed' | 'InProgress' | 'Completed' | 'Canceled';

export interface IShift {
    id: string; // ID del documento en Firestore
    
    // Relación con Empleado
    employeeId: string;
    employeeName: string;
    
    // Relación con Objetivo (Cliente/Sede)
    objectiveId: string;
    objectiveName: string;
    
    // Tiempos
    startTime: FirestoreDate;
    endTime: FirestoreDate;
    
    // Estado del ciclo de vida
    status: ShiftStatus;

    // Datos opcionales de auditoría en el mismo documento (si aplica)
    checkInTime?: FirestoreDate;
    checkOutTime?: FirestoreDate;

    // Metadatos
    schedulerId: string;
    updatedAt: FirestoreDate;

    // Roles y Flags Visuales
    role?: string;           // Ej: 'Vigilador'
    isOvertime?: boolean;    // 🛑 NUEVO: Indica si el turno excede horas (Visualización Ámbar)
}



