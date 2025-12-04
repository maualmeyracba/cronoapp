import { Module } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { ClientService } from './client.service';
import { EmployeeService } from './employee.service';
import { SystemUserService } from './system-user.service';
// 👇 CORRECCIÓN: Importamos el servicio de ausencias
import { AbsenceService } from './absence.service';
// 👇 CORRECCIÓN: Importamos SchedulingModule para acceder a WorkloadService
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [
    SchedulingModule 
  ],
  providers: [
    DataManagementService,
    ClientService,
    EmployeeService,
    SystemUserService,
    AbsenceService // 👈 Registrado
  ],
  exports: [
    DataManagementService,
    ClientService,
    EmployeeService,
    SystemUserService,
    AbsenceService // 👈 Exportado
  ],
})
export class DataManagementModule {}