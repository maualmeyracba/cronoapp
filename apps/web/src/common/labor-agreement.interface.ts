import { Timestamp } from 'firebase/firestore'; 
// En backend: import * as admin from 'firebase-admin';

export interface ILaborAgreement {
    id: string;
    code: string;       // Ej: 'SUVICO', 'UOCRA'
    name: string;       // Ej: 'Seguridad Privada 422/05'
    
    // Reglas de Negocio (Lo que antes estaba fijo en código)
    maxHoursWeekly: number;       // 48
    maxHoursMonthly: number;      // 204
    overtimeThresholdDaily: number; // 12
    
    // Configuración de Extras
    saturdayCutoffHour: number;   // 13 (Sábado Inglés)
    nightShiftStart: number;      // 21
    nightShiftEnd: number;        // 6
    
    isActive: boolean;
    createdAt?: any;
}




