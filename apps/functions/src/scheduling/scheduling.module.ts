import { Module, forwardRef } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
import { AuditService } from './audit.service';
import { GeofencingService } from './geofencing.service';
// 1. Importar PatternService
import { PatternService } from './pattern.service'; 
import { DataManagementModule } from '../data-management/data-management.module';

@Module({
  imports: [
    forwardRef(() => DataManagementModule)
  ],
  providers: [
    SchedulingService,
    ShiftOverlapService,
    WorkloadService,
    AuditService,
    GeofencingService,
    // 2. Registrarlo aquí
    PatternService 
  ],
  exports: [
    SchedulingService,
    WorkloadService,
    AuditService,
    // 3. Exportarlo aquí para que index.ts lo vea
    PatternService 
  ],
})
export class SchedulingModule {}