import { Module } from '@nestjs/common';

// Servicios de Autenticación
import { AuthService } from './auth/auth.service';

// Servicios de Agendamiento y WFM
import { SchedulingService } from './scheduling/scheduling.service';
import { WorkloadService } from './scheduling/workload.service';
import { AuditService } from './scheduling/audit.service';

// Servicios de Gestión de Datos
import { DataManagementService } from './data-management/data-management.service';
import { EmployeeService } from './data-management/employee.service';
import { SystemUserService } from './data-management/system-user.service';
import { AbsenceService } from './data-management/absence.service';

// 🛑 1. IMPORTACIÓN DEL SERVICIO DE CLIENTES
import { ClientService } from './data-management/client.service';

@Module({
  imports: [],
  controllers: [],
  providers: [
    // Auth
    AuthService,
    
    // WFM Core
    SchedulingService,
    WorkloadService,
    AuditService,
    
    // Data Management
    DataManagementService,
    EmployeeService,
    SystemUserService,
    AbsenceService,
    
    // 🛑 2. REGISTRO OBLIGATORIO (Soluciona el Error 500 en manageHierarchy)
    ClientService,
  ],
})
export class AppModule {}