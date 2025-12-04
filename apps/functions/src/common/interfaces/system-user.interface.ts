import * as admin from 'firebase-admin';

/**
 * Roles específicos para el Back-Office.
 */
export type SystemRole = 'SuperAdmin' | 'Scheduler' | 'HR_Manager' | 'Viewer';

/**
 * @interface ISystemUser
 * @description Usuario administrativo con acceso al Panel de Control.
 * Se almacena en la colección 'system_users'.
 */
export interface ISystemUser {
  uid: string;
  email: string;
  displayName: string;
  role: SystemRole;
  
  /** Estado del acceso */
  status: 'Active' | 'Inactive';
  
  /** Fecha de creación */
  createdAt: admin.firestore.Timestamp;
  
  /** Último acceso (Opcional, para auditoría futura) */
  lastLogin?: admin.firestore.Timestamp;
}