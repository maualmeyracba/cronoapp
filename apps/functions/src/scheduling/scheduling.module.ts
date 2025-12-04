import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { ShiftOverlapService } from './shift-overlap.service';
// 🛑 Importamos el nuevo servicio de reglas de negocio
import { WorkloadService } from '../scheduling/workload.service';

/**
 * @module SchedulingModule
 * @description Módulo de NestJS para toda la lógica de agendamiento de turnos.
 * Agrupa los servicios de asignación, validación de solapamiento y carga de trabajo.
 */
@Module({
  imports: [],
  providers: [
    SchedulingService,      // Servicio Principal
    ShiftOverlapService,    // Validador de Solapamiento (P2)
    WorkloadService         // Validador de Carga/Ausencias (Reglas de Negocio)
  ],
  exports: [SchedulingService], // Exportamos el servicio principal para usarlo en index.ts
})
export class SchedulingModule {}