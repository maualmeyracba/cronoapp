import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { callManageData } from '@/services/firebase-client.service';
import { IObjective } from '@/common/interfaces/client.interface';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { 
    MapPin, Search, ArrowRight, Building2, 
    AlertTriangle, Users, Activity, Navigation 
} from 'lucide-react';
import { useClient } from '@/context/ClientContext'; 

// --- CONFIGURACIÓN DEL MAPA ---
const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires Default

// Estilo "Silver" limpio para uso profesional (menos distracciones)
const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    fullscreenControl: true,
    styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
    ]
};

// --- ICONOS DE MAPA DINÁMICOS ---
const getMarkerIcon = (status: 'ok' | 'alert' | 'warning') => {
    let color = '#10B981'; // Verde (Operativo)
    if (status === 'alert') color = '#EF4444'; // Rojo (Problema)
    if (status === 'warning') color = '#F59E0B'; // Amarillo (Atención)

    return {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: "#FFFFFF",
        scale: 1.8,
        anchor: { x: 12, y: 22 }
    } as google.maps.Symbol;
};

// Interfaz extendida para UI
interface IObjectiveMap extends IObjective {
    status: 'ok' | 'alert' | 'warning';
    activePersonnel: number;
}

function OperatorMapPage() {
  const router = useRouter();
  const { selectedClientId, selectedClient } = useClient(); // Conexión con el selector global
  
  const [allObjectives, setAllObjectives] = useState<IObjectiveMap[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObj, setSelectedObj] = useState<IObjectiveMap | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [stats, setStats] = useState({ total: 0, alerts: 0, active: 0 });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  // 1. CARGA DE DATOS (Reactiva al Filtro Global)
  useEffect(() => {
    const loadObjectives = async () => {
        try {
            // Si selectedClientId es "", el backend debe traer TODOS (ajustar backend si es necesario o manejarlo aquí)
            // Asumimos que manageData soporta payload vacío para traer todo si eres admin
            const payload = selectedClientId ? { clientId: selectedClientId } : {};
            const res = await callManageData({ action: 'GET_ALL_OBJECTIVES', payload });
            
            const data = (res.data as any).data || [];
            
            // 🛑 ENRIQUECIMIENTO (Simulación de estado operativo)
            // En el futuro, esto vendrá del backend con el estado real de la Torre de Control
            const enrichedData = data
                .filter((o: IObjective) => o.location && o.location.latitude)
                .map((obj: IObjective, index: number) => ({
                    ...obj,
                    status: index % 5 === 0 ? 'alert' : 'ok', // Mock de alertas
                    activePersonnel: Math.floor(Math.random() * 4) // Mock de personal
                }));

            setAllObjectives(enrichedData);
            
            // Recalcular Zoom del Mapa para abarcar todos los puntos
            if (mapInstance && enrichedData.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                enrichedData.forEach((o: IObjective) => bounds.extend({ lat: o.location.latitude, lng: o.location.longitude }));
                mapInstance.fitBounds(bounds);
            }

            // KPIs Rápidos
            setStats({
                total: enrichedData.length,
                alerts: enrichedData.filter((o: any) => o.status === 'alert').length,
                active: enrichedData.reduce((acc: number, curr: any) => acc + curr.activePersonnel, 0)
            });

        } catch (error) {
            console.error("Error cargando mapa:", error);
        }
    };
    loadObjectives();
  }, [selectedClientId, mapInstance]);

  // 2. FILTRADO LOCAL (Buscador)
  const filteredObjectives = useMemo(() => {
      return allObjectives.filter(obj => 
        obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [allObjectives, searchQuery]);

  // 3. HANDLERS
  const handleSelectObjective = useCallback((obj: IObjectiveMap) => {
      setSelectedObj(obj);
      if (mapInstance) {
          mapInstance.panTo({ lat: obj.location.latitude, lng: obj.location.longitude });
          mapInstance.setZoom(15);
      }
  }, [mapInstance]);

  const goToControlTower = () => {
      if (selectedObj) {
          router.push(`/admin/objective-detail/${selectedObj.id}`);
      }
  };

  return (
    <DashboardLayout title="Centro de Operaciones Global">
      
      {/* 1. BARRA DE KPIS (HEADER OPERATIVO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Objetivos Visibles</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                  <p className="text-xs text-slate-400">{selectedClient ? selectedClient.businessName : 'Todas las Empresas'}</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Building2 size={24} /></div>
          </div>

          <div className={`p-4 rounded-xl shadow-sm border flex items-center justify-between ${stats.alerts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
              <div>
                  <p className={`text-xs font-bold uppercase ${stats.alerts > 0 ? 'text-red-600' : 'text-slate-500'}`}>Incidencias Activas</p>
                  <p className={`text-2xl font-bold ${stats.alerts > 0 ? 'text-red-700' : 'text-slate-800'}`}>{stats.alerts}</p>
                  <p className="text-xs text-slate-400">Requieren atención</p>
              </div>
              <div className={`p-2 rounded-lg ${stats.alerts > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
                  <AlertTriangle size={24} />
              </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Fuerza Activa</p>
                  <p className="text-2xl font-bold text-green-700">{stats.active}</p>
                  <p className="text-xs text-slate-400">Empleados en sitio</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-green-600"><Activity size={24} /></div>
          </div>
      </div>

      {/* 2. AREA DE TRABAJO (SIDEBAR + MAPA) */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-250px)] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* --- LISTA LATERAL (SIDEBAR) --- */}
        <div className="w-full lg:w-96 border-r border-slate-200 flex flex-col bg-white z-10 relative">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar objetivo..." 
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
                {filteredObjectives.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">No se encontraron resultados.</div>}
                
                {filteredObjectives.map(obj => (
                    <div 
                        key={obj.id}
                        onClick={() => handleSelectObjective(obj)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                            selectedObj?.id === obj.id 
                            ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-50' 
                            : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`font-bold text-sm ${selectedObj?.id === obj.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                                    {obj.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate w-48 flex items-center mt-0.5">
                                    <MapPin size={10} className="mr-1"/> {obj.address}
                                </p>
                            </div>
                            {/* Semáforo en la lista */}
                            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                                obj.status === 'alert' ? 'bg-red-500 animate-pulse' : 
                                obj.status === 'warning' ? 'bg-yellow-400' : 'bg-green-500'
                            }`} />
                        </div>
                        {selectedObj?.id === obj.id && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                                <span className="text-[10px] text-indigo-600 font-bold flex items-center">
                                    VER EN MAPA <Navigation size={10} className="ml-1"/>
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* --- MAPA --- */}
        <div className="flex-1 relative bg-slate-100">
            {isLoaded ? (
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={defaultCenter}
                    zoom={10}
                    onLoad={map => setMapInstance(map)}
                    options={mapOptions}
                >
                    {filteredObjectives.map(obj => (
                        <Marker
                            key={obj.id}
                            position={{ lat: obj.location.latitude, lng: obj.location.longitude }}
                            onClick={() => handleSelectObjective(obj)}
                            icon={getMarkerIcon(obj.status)}
                            animation={selectedObj?.id === obj.id ? google.maps.Animation.BOUNCE : undefined}
                        />
                    ))}

                    {/* POPUP DE DETALLE (InfoWindow) */}
                    {selectedObj && (
                        <InfoWindow
                            position={{ lat: selectedObj.location.latitude, lng: selectedObj.location.longitude }}
                            onCloseClick={() => setSelectedObj(null)}
                            options={{ pixelOffset: new google.maps.Size(0, -40) }}
                        >
                            <div className="p-1 min-w-[240px]">
                                <div className="flex items-center justify-between mb-3 border-b pb-2 border-gray-100">
                                    <h4 className="font-extrabold text-slate-800 text-sm">{selectedObj.name}</h4>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                        selectedObj.status === 'alert' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {selectedObj.status === 'alert' ? 'INCIDENCIA' : 'OPERATIVO'}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-slate-50 p-2 rounded text-center">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Personal</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedObj.activePersonnel}</p>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded text-center">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Estado</p>
                                        <p className="text-sm font-bold text-slate-700">Activo</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={goToControlTower}
                                    className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-black flex items-center justify-center gap-2 transition-all shadow-md group"
                                >
                                    ABRIR TORRE DE CONTROL 
                                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform"/>
                                </button>
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
                    <p className="animate-pulse">Cargando satélite...</p>
                </div>
            )}
        </div>

      </div>
    </DashboardLayout>
  );
}

export default withAuthGuard(OperatorMapPage, ['admin', 'manager', 'operator', 'supervisor']);



