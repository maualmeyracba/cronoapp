"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeofencingService = void 0;
const common_1 = require("@nestjs/common");
// Radio de la Tierra en kilómetros (km)
const EARTH_RADIUS_KM = 6371;
// Radio de tolerancia: El empleado debe estar a menos de 100 metros del objetivo.
const GEOFENCE_RADIUS_KM = 0.1; // 100 metros
/**
 * @class GeofencingService
 * @description Lógica pura para el cálculo de distancia y verificación de Geofence (SRP/D5).
 */
let GeofencingService = class GeofencingService {
    /**
     * @function degreesToRadians
     * @description Convierte grados decimales a radianes.
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    /**
     * @function calculateDistance
     * @description Calcula la distancia entre dos pares de coordenadas (Fórmula del Haversine).
     * @returns {number} Distancia en kilómetros.
     */
    calculateDistance(p1, p2) {
        const lat1 = this.degreesToRadians(p1.latitude);
        const lon1 = this.degreesToRadians(p1.longitude);
        const lat2 = this.degreesToRadians(p2.latitude);
        const lon2 = this.degreesToRadians(p2.longitude);
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        // Fórmula Haversine
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c; // Distancia en KM
    }
    /**
     * @function isInGeofence
     * @description Verifica si el punto del empleado está dentro del radio del objetivo.
     * @param {Coordinates} employeeCoords - Coordenadas reportadas por el empleado.
     * @param {Coordinates} objectiveCoords - Coordenadas registradas del objetivo.
     * @returns {boolean} True si la distancia es menor al radio de tolerancia.
     */
    isInGeofence(employeeCoords, objectiveCoords) {
        const distance = this.calculateDistance(employeeCoords, objectiveCoords);
        return distance <= GEOFENCE_RADIUS_KM;
    }
};
exports.GeofencingService = GeofencingService;
exports.GeofencingService = GeofencingService = __decorate([
    (0, common_1.Injectable)()
], GeofencingService);
//# sourceMappingURL=geofencing.service.js.map