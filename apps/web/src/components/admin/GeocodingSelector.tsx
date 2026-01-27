import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface GeocodingSelectorProps {
  address: string;
  onCoordinatesSelected: (lat: string, lng: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Componente Modal para buscar coordenadas geográficas a partir de una dirección.
 * Utiliza la API de Geocodificación de Google Maps.
 */
export const GeocodingSelector: React.FC<GeocodingSelectorProps> = ({ address, onCoordinatesSelected, onClose, isOpen }) => {
  const [loading, setLoading] = useState(false);
  // Acceso seguro a la clave de API configurada en .env.local
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; 

  if (!isOpen) return null;

  /**
   * Fetches coordinates for the given address using Google's Geocoding API.
   */
  const fetchCoordinates = async () => {
    if (!address.trim()) {
      toast.error("Ingrese una dirección válida para buscar.");
      return;
    }
    // Verificación de seguridad
    if (!apiKey || apiKey.trim() === '') {
      toast.error("Error: Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).");
      console.error("GeocodingSelector: Missing Google Maps API Key.");
      return;
    }

    setLoading(true);
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        
        // Mantenemos la alta precisión para el estado del formulario
        const latString = lat.toFixed(6); 
        const lngString = lng.toFixed(6);

        onCoordinatesSelected(latString, lngString);
        toast.success(`Coordenadas asignadas a: ${address}`);
        onClose();
      } else {
        toast.error("No se encontraron coordenadas para la dirección proporcionada.");
      }
    } catch (error) {
      console.error("Error al consultar la API de Google:", error);
      toast.error("Error de red al buscar coordenadas.");
    } finally {
      setLoading(false);
    }
  };
  
  // Estructura del Modal (usando Tailwind)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Buscar Coordenadas</h3>
        <p className="text-sm text-gray-600 mb-4">
          Dirección a buscar: <span className="font-semibold text-indigo-600">{address}</span>
        </p>
        
        <button
          onClick={fetchCoordinates}
          disabled={loading || !address.trim()}
          className={`w-full py-2 px-4 rounded-md text-white font-medium transition duration-200 ${
            loading || !address.trim() ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading ? 'Buscando...' : 'Confirmar Búsqueda en Mapa'}
        </button>
        
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition duration-200"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};



