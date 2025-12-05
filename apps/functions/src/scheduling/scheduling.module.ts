import { Module, forwardRef } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
import { AuditService } from './audit.service';
import { GeofencingService } from './geofencing.service';
// Importamos el módulo de datos
import { DataManagementModule } from '../data-management/data-management.module';

@Module({
  imports: [
    // 🛑 FIX: Usamos forwardRef para romper el ciclo con DataManagement
    forwardRef(() => DataManagementModule)
  ],
  providers: [
    SchedulingService,
    ShiftOverlapService,
    WorkloadService,
    AuditService,      // Servicio de Auditoría (Fichaje)
    GeofencingService  // Dependencia de Auditoría
  ],
  exports: [
    SchedulingService,
    WorkloadService,
    AuditService       // Exportamos para que la API lo vea
  ],
})
export class SchedulingModule {}