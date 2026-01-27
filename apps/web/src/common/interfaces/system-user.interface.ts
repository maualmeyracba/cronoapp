import { Timestamp } from 'firebase/firestore'; // 🛑 SDK CLIENTE (Importante para la Web)

/**
 * Roles Jerárquicos del Sistema (RBAC):
 * - SuperAdmin: IT / Dueño del SaaS. Acceso total.
 * - Manager: Gerente de Unidad. Ve todo dentro de su unidad.
 * - Scheduler: Planificador. Gestiona turnos y asignaciones.
 * - Supervisor: Campo. Gestiona incidencias y personal.
 * - Operator: Monitoreo. Solo lectura o vista de tablero en vivo.
 */
export type SystemRole = 
  | 'SuperAdmin' 
  | 'Manager' 
  | 'Scheduler' 
  | 'Supervisor' 
  | 'Operator';

/**
 * Interfaz de Usuario del Sistema (Frontend).
 * Define la estructura de los administradores que acceden al Back-Office.
 */
export interface ISystemUser {
  uid: string;
  email: string;
  displayName: string;
  role: SystemRole;
  
  // ID de la Unidad de Negocio a la que pertenece
  // Si es undefined y el rol es SuperAdmin, tiene acceso global.
  businessUnitId?: string; 
  
  status: 'Active' | 'Inactive';
  
  // Fechas usando el tipo compatible con el SDK de Cliente
  createdAt: Timestamp;
  lastLogin?: Timestamp;
}



