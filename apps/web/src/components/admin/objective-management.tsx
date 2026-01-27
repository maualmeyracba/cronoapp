import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; // 🛑 NECESARIO para la navegación de la tabla
import { callManageData } from '@/services/firebase-client.service';
import { IObjective } from '@/common/interfaces/client.interface';
import { useClient } from '@/context/ClientContext';
import toast from 'react-hot-toast';
import { GeocodingSelector } from './GeocodingSelector'; 
import styles from './ObjectiveManagement.module.css'; // Para cumplir con Next.js


// -- 1. INTERFACES Y CONSTANTES (Sin cambios) --
interface ObjectiveFormState {
  name: string;
  address: string;
  latitude: string; 
  longitude: string;
}

const STYLES = {
    inputClass: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-200",
    readOnlyInputClass: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none bg-gray-50 text-gray-500 cursor-not-allowed sm:text-sm transition duration-200",
    labelClass: "block text-sm font-medium text-gray-700",
    buttonDisabled: "opacity-70 cursor-not-allowed",
    buttonActive: "hover:bg-indigo-700",
};

const cleanAndParseCoordinate = (coordString: string): number => {
    const cleanedString = coordString.trim().replace(',', '.'); 
    return parseFloat(cleanedString);
};


export function ObjectiveManagement() {
  const router = useRouter(); // 🛑 Instancia del router
  const { selectedClientId, selectedClient } = useClient();

  const [objectives, setObjectives] = useState<IObjective[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false); 
  
  const [formData, setFormData] = useState<ObjectiveFormState>({
    name: '', address: '', latitude: '', longitude: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Carga de objetivos.
   */
  const fetchObjectives = async () => {
    if (!selectedClientId) {
        setObjectives([]);
        return;
    }
    setLoading(true);
    try {
      const result = await callManageData({ 
          action: 'GET_ALL_OBJECTIVES', 
          payload: { clientId: selectedClientId } 
      });
      const response = result.data as { success: boolean, data: IObjective[] };
      setObjectives(response.data || []);
      
    } catch (error) {
      console.error('[ObjectiveManagement] Fetch Error:', error);
      toast.error("Error al cargar objetivos");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchObjectives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  /**
   * Maneja el cambio en los inputs name y address.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'name' || name === 'address') {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /**
   * Callback que recibe las coordenadas desde el GeocodingSelector y actualiza el estado.
   */
  const handleCoordinatesSelected = (lat: string, lng: string) => {
      setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
      }));
      setIsSelectorOpen(false); // Cerramos el modal
  };

  /**
   * Valida y envía la creación del objetivo.
   */
  const handleCreateObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Pre-Submission Checks
    if (!selectedClientId) {
        toast.error("⚠️ Debe seleccionar una empresa en el menú lateral.");
        return;
    }
    
    // Chequeo estricto de todos los campos obligatorios
    if (!formData.name.trim() || 
        !formData.address.trim() ||
        !formData.latitude.trim() || 
        !formData.longitude.trim() 
    ) {
        toast.error("Complete todos los campos obligatorios: Nombre, Dirección y Coordenadas.");
        return;
    }
    
    // 2. Parsing y Validación
    const lat = cleanAndParseCoordinate(formData.latitude);
    const lng = cleanAndParseCoordinate(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) { 
        toast.error("Las coordenadas deben ser números válidos (ej: -34.60)."); 
        return; 
    }

    // 3. Submission Logic
    setSubmitting(true);
    try {
      const payload = { 
          name: formData.name.trim(),
          address: formData.address.trim(),
          clientId: selectedClientId,
          location: { latitude: lat, longitude: lng } 
      };
      
      await callManageData({ action: 'CREATE_OBJECTIVE', payload });
      
      toast.success(`Objetivo "${formData.name}" creado para ${selectedClient?.businessName}`);
      setFormData({ name: '', address: '', latitude: '', longitude: '' });
      fetchObjectives();

    } catch (error) { 
        console.error('[ObjectiveManagement] Create Error:', error);
        toast.error("Error al crear el objetivo."); 
    } finally { 
        setSubmitting(false); 
    }
  };


  return (
    <div className="space-y-8">
      {/* --- FORMULARIO (Sección 1) --- */}
      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200">
        {/* ... Header del formulario ... */}
        
        <form onSubmit={handleCreateObjective} noValidate className="space-y-4">
          <div>
            <label className={STYLES.labelClass}>Nombre de la Sucursal/Puesto</label>
            <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                className={STYLES.inputClass} 
                placeholder="Ej: Casa Central" 
            />
          </div>
          <div>
            <label className={STYLES.labelClass}>Dirección Física</label>
            <input 
                type="text" 
                name="address" 
                value={formData.address} 
                onChange={handleInputChange} 
                className={STYLES.inputClass} 
                placeholder="Av. Siempreviva 742" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className={STYLES.labelClass}>Latitud</label>
                <input 
                    type="number" 
                    name="latitude" 
                    value={formData.latitude} 
                    onChange={handleInputChange} 
                    className={STYLES.readOnlyInputClass} 
                    readOnly={true} // Deshabilitar escritura manual
                    step="any" 
                    placeholder="Asignar con el botón" 
                />
            </div>
            <div>
                <label className={STYLES.labelClass}>Longitud</label>
                <input 
                    type="number" 
                    name="longitude" 
                    value={formData.longitude} 
                    onChange={handleInputChange} 
                    className={STYLES.readOnlyInputClass} 
                    readOnly={true} // Deshabilitar escritura manual
                    step="any" 
                    placeholder="Asignar con el botón" 
                />
            </div>
          </div>
          
          {/* Botón para Activar la Búsqueda de Coordenadas */}
          <button 
              type="button" 
              onClick={() => setIsSelectorOpen(true)}
              disabled={!formData.address.trim()} 
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none transition duration-200 
                  ${!formData.address.trim() ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
              Buscar/Asignar Coordenadas (Paso 1)
          </button>

          {/* Botón Final de Creación */}
          <button 
            type="submit" 
            disabled={submitting || !selectedClientId || !formData.latitude.trim()} 
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 focus:outline-none transition duration-200 
                ${submitting || !selectedClientId || !formData.latitude.trim() ? STYLES.buttonDisabled : STYLES.buttonActive}`}
          >
            {submitting ? 'Guardando...' : 'Crear Objetivo (Paso 2)'}
          </button>
        </form>
      </div>

      {/* INTEGRACIÓN DEL MODAL DE GEOCODIFICACIÓN */}
      <GeocodingSelector 
          address={formData.address}
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          onCoordinatesSelected={handleCoordinatesSelected}
      />
      
      {/* --- LISTADO DE OBJETIVOS (Sección 2) --- */}
      <div className={`${styles.objectiveListCard} bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200`}>
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">
                Objetivos de {selectedClient?.businessName || '...'}
            </h3>
            <span className="bg-gray-100 text-gray-600 py-1 px-3 rounded-full text-xs font-bold">{objectives.length}</span>
        </div>
        {loading ? <div className="p-6 text-center text-gray-500">Cargando datos...</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre y Ubicación</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {objectives.length === 0 ? (
                    <tr><td className="px-6 py-8 text-center text-sm text-gray-500 italic">No hay objetivos registrados para esta empresa.</td></tr>
                ) : (
                    objectives.map((obj) => (
                    <tr 
                        key={obj.id} 
                        // 🛑 FIX DE NAVEGACIÓN: Hace la fila clickeable para ver detalles
                        className="hover:bg-gray-50 transition duration-150 cursor-pointer" 
                        onClick={() => router.push(`/admin/objective-detail/${obj.id}`)} 
                    >
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                                <span className="font-bold text-lg">{obj.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{obj.name}</div>
                            <div className="text-sm text-gray-500">{obj.address}</div>
                            <div className="text-xs text-indigo-400 font-mono mt-1">
                                ({obj.location?.latitude?.toFixed(4) || 'N/A'}, {obj.location?.longitude?.toFixed(4) || 'N/A'})
                            </div>
                            </div>
                        </div>
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ObjectiveManagement;



