/**
 * @typedef {string} EmployeeRole
 * @description Define los roles de seguridad del sistema.
 */
export type EmployeeRole = 'admin' | 'employee';

/**
 * @typedef {string} ContractType
 * @description Define la modalidad de contratación para reglas de negocio.
 */
export type ContractType = 'FullTime' | 'PartTime' | 'Eventual';

/**
 * @interface IEmployee
 * @description Estructura del documento de perfil de empleado en Firestore.
 */
export interface IEmployee {
  /**
   * ID único del usuario de Firebase Authentication (UID).
   */
  uid: string;
  /**
   * Nombre completo del empleado.
   */
  name: string;
  /**
   * Rol asignado (para Custom Claims y reglas de seguridad).
   */
  role: EmployeeRole;
  /**
   * Correo electrónico para acceso.
   */
  email: string;
  /**
   * Indica si el empleado está activo en la empresa.
   */
  isAvailable: boolean;

  // 🛑 NUEVOS CAMPOS DE CONTROL DE NEGOCIO (WFM)
  /**
   * Límite de horas mensuales permitidas (Ej: 176 hs estándar).
   * Si se supera, el sistema bloqueará la asignación de nuevos turnos.
   */
  maxHoursPerMonth: number;
  
  /**
   * Tipo de contrato.
   */
  contractType: ContractType;
}