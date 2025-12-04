// apps/functions/src/common/interfaces/shift.interface.ts
import * as admin from 'firebase-admin'; // 🛑 CAMBIO CLAVE: Importar el módulo core de admin

export interface IShift {
  id: string;
  employeeId: string;
  employeeName: string;
  objectiveId: string;
  objectiveName: string;
  // 🛑 Referenciar el Timestamp a través del namespace de admin.
  startTime: admin.firestore.Timestamp; 
  endTime: admin.firestore.Timestamp;
  status: 'Assigned' | 'Confirmed' | 'InProgress' | 'Completed' | 'Canceled';
  checkInTime?: admin.firestore.Timestamp;
  checkOutTime?: admin.firestore.Timestamp;
  schedulerId: string;
  updatedAt: admin.firestore.Timestamp;
}