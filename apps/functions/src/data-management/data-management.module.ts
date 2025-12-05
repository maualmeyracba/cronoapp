import { Module, forwardRef } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { ClientService } from './client.service';
import { EmployeeService } from './employee.service';
import { SystemUserService } from './system-user.service';
import { AbsenceService } from './absence.service';
// Importamos el módulo de agendamiento
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [
    // 🛑 FIX: Usamos forwardRef para romper el ciclo con Scheduling
    forwardRef(() => SchedulingModule)
  ],
  providers: [
    DataManagementService,
    ClientService,
    EmployeeService,
    SystemUserService,
    AbsenceService
  ],
  exports: [
    DataManagementService,
    ClientService,
    EmployeeService,
    SystemUserService,
    AbsenceService
  ],
})
export class DataManagementModule {}