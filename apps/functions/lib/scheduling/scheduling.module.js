"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingModule = void 0;
const common_1 = require("@nestjs/common");
const scheduling_service_1 = require("./scheduling.service");
const shift_overlap_service_1 = require("./shift-overlap.service");
// 🛑 Importamos el nuevo servicio de reglas de negocio
const workload_service_1 = require("../scheduling/workload.service");
/**
 * @module SchedulingModule
 * @description Módulo de NestJS para toda la lógica de agendamiento de turnos.
 * Agrupa los servicios de asignación, validación de solapamiento y carga de trabajo.
 */
let SchedulingModule = class SchedulingModule {
};
exports.SchedulingModule = SchedulingModule;
exports.SchedulingModule = SchedulingModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        providers: [
            scheduling_service_1.SchedulingService, // Servicio Principal
            shift_overlap_service_1.ShiftOverlapService, // Validador de Solapamiento (P2)
            workload_service_1.WorkloadService // Validador de Carga/Ausencias (Reglas de Negocio)
        ],
        exports: [scheduling_service_1.SchedulingService], // Exportamos el servicio principal para usarlo en index.ts
    })
], SchedulingModule);
//# sourceMappingURL=scheduling.module.js.map