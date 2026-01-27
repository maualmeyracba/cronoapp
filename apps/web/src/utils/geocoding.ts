/**
 * Utilidad para geocodificación usando Google Maps Platform.
 */
export async function getCoordinatesFromAddress(address: string): Promise<{ lat: number, lng: number } | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

    // 1. Diagnóstico de la Clave
    if (!apiKey) {
        console.error("❌ ERROR CRÍTICO: La variable NEXT_PUBLIC_GOOGLE_MAPS_KEY está vacía o undefined.");
        console.info("💡 RECUERDA: Debes crear el archivo .env.local en apps/web/ y reiniciar el servidor (npm run dev).");
        return null;
    }

    try {
        console.log(`📡 Consultando Google Maps para: "${address}"`);
        
        const query = encodeURIComponent(address);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        // 2. Diagnóstico de la Respuesta de Google
        if (data.status !== 'OK') {
            console.error("❌ Google Maps API Error:", data.status);
            console.error("Mensaje de error:", data.error_message); // Muy útil para ver si falta habilitar la API
            
            if (data.status === 'REQUEST_DENIED') {
                console.warn("⚠️ Revisa en Google Cloud Console que la 'Geocoding API' esté habilitada y que la API Key sea correcta.");
            }
            return null;
        }

        if (data.results.length > 0) {
            const location = data.results[0].geometry.location;
            console.log("✅ Coordenadas encontradas:", location);
            return {
                lat: location.lat,
                lng: location.lng
            };
        } else {
            console.warn("⚠️ Google no encontró resultados para esa dirección.");
            return null;
        }

    } catch (error) {
        console.error("❌ Error de red o fetch:", error);
        return null;
    }
}



