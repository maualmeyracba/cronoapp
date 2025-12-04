import * as admin from 'firebase-admin';

/**
 * @interface IClient
 * @description La empresa o entidad que contrata nuestros servicios.
 */
export interface IClient {
  id: string;
  businessName: string;
  cuit: string;
  contactName: string;
  contactEmail: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: admin.firestore.Timestamp;
}

/**
 * @interface IObjective
 * @description El lugar físico, sucursal o puesto donde se presta el servicio.
 */
export interface IObjective {
  id: string;
  clientId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  zones?: string[];
}

/**
 * @interface IServiceContract
 * @description Define el acuerdo de nivel de servicio (SLA).
 */
export interface IServiceContract {
  id: string;
  objectiveId: string;
  name: string;
  startDate: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  totalHoursPerMonth: number;
  isActive: boolean;
}

/**
 * @interface IShiftType
 * @description Plantilla de turno (Modalidad).
 */
export interface IShiftType {
  id: string;
  contractId: string;
  name: string;
  code: string;
  color: string;
  startTime: string;
  durationHours: number;
  requiredRole?: string;
}