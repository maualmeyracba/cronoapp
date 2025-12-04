"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// D5: Unit Test que verifica la REGRA DE NEGOCIO más importante.
const shift_overlap_service_1 = require("../../src/scheduling/shift-overlap.service");
describe('ShiftOverlapService (Core Logic D5)', () => {
    let service;
    beforeEach(() => {
        service = new shift_overlap_service_1.ShiftOverlapService();
    });
    // Turno base: De 10:00 a 14:00 (4 horas)
    const T_START = new Date('2025-11-20T10:00:00.000Z');
    const T_END = new Date('2025-11-20T14:00:00.000Z');
    // CASOS DE ÉXITO (Solapamiento)
    it('should return TRUE if the new shift starts inside and ends outside the existing shift', () => {
        // Nuevo turno: 12:00 a 16:00
        const newStart = new Date('2025-11-20T12:00:00.000Z');
        const newEnd = new Date('2025-11-20T16:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(true);
    });
    it('should return TRUE if the new shift is entirely contained within the existing shift', () => {
        // Nuevo turno: 11:00 a 13:00
        const newStart = new Date('2025-11-20T11:00:00.000Z');
        const newEnd = new Date('2025-11-20T13:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(true);
    });
    it('should return TRUE if the new shift starts before and ends inside the existing shift', () => {
        // Nuevo turno: 09:00 a 11:00
        const newStart = new Date('2025-11-20T09:00:00.000Z');
        const newEnd = new Date('2025-11-20T11:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(true);
    });
    // CASOS DE FRACASO (No Solapamiento)
    it('should return FALSE if the new shift is adjacent (starts exactly when the other ends)', () => {
        // Nuevo turno: 14:00 a 18:00
        const newStart = new Date('2025-11-20T14:00:00.000Z');
        const newEnd = new Date('2025-11-20T18:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(false);
    });
    it('should return FALSE if the new shift ends exactly when the other starts', () => {
        // Nuevo turno: 06:00 a 10:00
        const newStart = new Date('2025-11-20T06:00:00.000Z');
        const newEnd = new Date('2025-11-20T10:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(false);
    });
    it('should return FALSE if the new shift is completely outside the range', () => {
        // Nuevo turno: 07:00 a 09:00
        const newStart = new Date('2025-11-20T07:00:00.000Z');
        const newEnd = new Date('2025-11-20T09:00:00.000Z');
        expect(service.isOverlap(T_START, T_END, newStart, newEnd)).toBe(false);
    });
});
//# sourceMappingURL=shift-overlap.service.spec.js.map