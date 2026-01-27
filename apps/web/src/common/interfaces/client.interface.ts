import { Timestamp } from 'firebase/firestore';
import { ReactNode } from 'react';

export interface IClient {
  id: string;
  businessName: ReactNode;
  cuit: ReactNode;
  contactName: string;
  contactEmail: ReactNode;
  name: string;
  status: 'Active' | 'Inactive';
  createdAt: Timestamp;
}

export interface IObjective {
  id: string;
  clientId: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number; };
  type: string;
}

// 🛑 CLAVE: IServiceContract con campos operativos
export interface IServiceContract {
  id: string;
  objectiveId: string;
  name: string;        
  totalHoursPerMonth: number;
  isActive: boolean;
  startDate: any; 
  endDate?: any;
  quantity?: number;      // Dotación (Personas)
  daysOfWeek?: number[];  // Días [0-6]
}

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



