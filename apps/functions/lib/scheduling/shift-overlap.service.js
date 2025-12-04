"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftOverlapService = void 0;
const common_1 = require("@nestjs/common");
/**
 * @class ShiftOverlapService
 * @description Servicio que encapsula la lógica pura (matemática) para determinar
 * si dos rangos de tiempo se cruzan. Cumple con SRP (SOLID).
 */
let ShiftOverlapService = class ShiftOverlapService {
    /**
     * @function isOverlap
     * @description Verifica si un nuevo rango de tiempo se superpone con un rango existente.
     * La fórmula evita solapamiento si los turnos son adyacentes (ej: uno termina a las 14:00 y el otro empieza a las 14:00).
     * @param {Date} existingStart - Inicio del turno ya registrado.
     * @param {Date} existingEnd - Fin del turno ya registrado.
     * @param {Date} newStart - Inicio del nuevo turno.
     * @param {Date} newEnd - Fin del nuevo turno.
     * @returns {boolean} True si hay solapamiento.
     */
    isOverlap(existingStart, existingEnd, newStart, newEnd) {
        // Si el nuevo empieza antes de que el existente termine Y el nuevo termina despues de que el existente empiece, SÍ hay solapamiento.
        return (newStart.getTime() < existingEnd.getTime() &&
            newEnd.getTime() > existingStart.getTime());
    }
};
exports.ShiftOverlapService = ShiftOverlapService;
exports.ShiftOverlapService = ShiftOverlapService = __decorate([
    (0, common_1.Injectable)()
], ShiftOverlapService);
//# sourceMappingURL=shift-overlap.service.js.map