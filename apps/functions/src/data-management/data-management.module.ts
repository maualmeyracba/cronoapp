import { Module } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { ClientService } from './client.service';
import { EmployeeService } from './employee.service';
// 🛑 Importamos el nuevo servicio de usuarios del sistema
import { SystemUserService } from './system-user.service';

@Module({
  imports: [],
  providers: [
    DataManagementService, // Objetivos básicos (Legacy)
    ClientService,         // Jerarquía Comercial
    EmployeeService,       // RRHH (Operativos)
    SystemUserService      // 🛑 Gestión de Admins (Back-Office)
  ],
  exports: [
    DataManagementService,
    ClientService,
    EmployeeService,
    SystemUserService      // 🛑 Exportar para usar en index.ts
  ],
})
export class DataManagementModule {}