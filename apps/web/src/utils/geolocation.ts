export interface IGeoCoordinates {
    latitude: number;
    longitude: number;
    accuracy: number;
}

/**
 * Obtiene la posición actual con promesa y manejo de errores en Español.
 */
export function getCurrentPosition(timeoutMs: number = 10000): Promise<IGeoCoordinates> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Tu navegador no soporta geolocalización.'));
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true, // Intentar usar GPS real
            timeout: timeoutMs,
            maximumAge: 0 // No usar caché
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let msg = 'Error desconocido de ubicación.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        msg = 'Permiso de ubicación denegado. Habilítalo en tu navegador.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        msg = 'Señal GPS no disponible.';
                        break;
                    case error.TIMEOUT:
                        msg = 'Se agotó el tiempo buscando señal GPS.';
                        break;
                }
                reject(new Error(msg));
            },
            options
        );
    });
}



