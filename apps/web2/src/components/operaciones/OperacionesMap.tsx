
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, AlertTriangle, Clock, Siren, CheckCircle } from 'lucide-react';

// --- GENERADOR DE ICONOS DINÁMICOS ---
const createCustomIcon = (status: 'OK' | 'WARNING' | 'CRITICAL' | 'RETENTION' | 'ACTIVE', countPresent: number, countTotal: number) => {
    let color = '#64748b'; // Slate (Default / Vacío / Gris)
    let shadowColor = 'rgba(0,0,0,0.2)';
    let iconHtml = '';
    let pulseClass = '';
    let showRing = false;

    if (status === 'ACTIVE') { 
        color = '#10b981'; // Verde
        shadowColor = 'rgba(16, 185, 129, 0.4)'; 
        showRing = true; 
    } 
    if (status === 'WARNING') { 
        color = '#f59e0b'; // Amarillo
        shadowColor = 'rgba(245, 158, 11, 0.4)'; 
        showRing = true;
    } 
    if (status === 'CRITICAL') { 
        color = '#ef4444'; // Rojo
        shadowColor = 'rgba(239, 68, 68, 0.4)'; 
        pulseClass = 'animate-pulse'; 
        showRing = true;
        iconHtml = `<div style="position: absolute; top: -5px; right: -5px; background: ${color}; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">!</div>`; 
    } 
    if (status === 'RETENTION') { 
        color = '#f97316'; // Naranja
        shadowColor = 'rgba(249, 115, 22, 0.5)'; 
        pulseClass = 'animate-pulse'; 
        showRing = true;
        iconHtml = `<div style="position: absolute; top: -5px; right: -5px; background: ${color}; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white;">R</div>`; 
    }

    const badgeHtml = countTotal > 0 
        ? `<div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: white; color: #1e293b; border-radius: 10px; padding: 2px 6px; font-size: 10px; font-weight: 800; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap;">${countPresent}/${countTotal}</div>` 
        : '';

    const ringHtml = showRing 
        ? `<div style="position: absolute; width: 100%; height: 100%; background-color: ${color}; opacity: 0.2; border-radius: 50%; animation: pulse-ring 2s infinite;"></div>`
        : '';

    const html = `
        <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            ${ringHtml}
            <div class="${pulseClass}" style="width: 32px; height: 32px; background-color: ${color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px ${shadowColor}; display: flex; align-items: center; justify-content: center; color: white;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    ${status === 'ACTIVE' ? '<path d="M20 6L9 17l-5-5"/>' : '<path d="M3 21h18M5 21V7l8-4 8 4v14"/>'}
                </svg>
            </div>
            ${iconHtml}
            ${badgeHtml}
        </div>
    `;

    return L.divIcon({ html, className: 'custom-map-icon', iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -40] });
};

const RecenterMap = ({ center }: { center: [number, number] }) => { const map = useMap(); useEffect(() => { map.setView(center, map.getZoom()); }, [center]); return null; };

interface Props { 
    center: [number, number]; 
    objectives: any[]; 
    processedData: any[]; 
    onAction: (action: string, id: string) => void; 
    setMapInstance: (map: any) => void; 
    onOpenResolution?: (shift: any) => void;
    currentFilter?: string;
}

export default function OperacionesMap({ center, objectives, processedData, onAction, setMapInstance, onOpenResolution, currentFilter }: Props) {

    const getObjectiveStatus = (objId: string) => {
        const shifts = processedData.filter(s => s.objectiveId === objId);
        const visibleList = shifts.filter(s => s.status !== 'CANCELED');

        const totalReq = visibleList.length;
        const totalPres = visibleList.filter(s => s.isPresent).length;
        
        const hasRetention = visibleList.some(s => s.isRetention);
        const hasCritical = visibleList.some(s => s.isUnassigned || s.isSlaGap);
        const hasActive = visibleList.some(s => s.isPresent);

        let status: 'OK' | 'WARNING' | 'CRITICAL' | 'RETENTION' | 'ACTIVE' = 'OK';
        if (hasCritical) status = 'CRITICAL';
        else if (hasRetention) status = 'RETENTION';
        else if (hasActive) status = 'ACTIVE';
        else if (totalReq > 0 && totalPres === 0) status = 'WARNING';

        return { status, req: totalReq, present: totalPres, guards: visibleList };
    };

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', background: '#f8fafc' }} ref={setMapInstance}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <RecenterMap center={center} />
            
            {objectives.map(obj => {
                if (!obj.lat || !obj.lng) return null;
                const audit = getObjectiveStatus(obj.id);
                const hasActivity = audit.guards.length > 0;

                if (!hasActivity && currentFilter !== 'TODOS') return null;

                // 🛑 FIX V29: LÓGICA DE CAPAS (Z-INDEX)
                // Los números más altos se renderizan ENCIMA
                let zIndex = 0;
                if (audit.status === 'CRITICAL') zIndex = 1000;
                else if (audit.status === 'RETENTION') zIndex = 900;
                else if (audit.status === 'ACTIVE') zIndex = 800;
                else if (audit.status === 'WARNING') zIndex = 700;
                else zIndex = 0; // Grises al fondo

                return (
                    <Marker 
                        key={obj.id} 
                        position={[obj.lat, obj.lng]} 
                        icon={createCustomIcon(audit.status, audit.present, audit.req)}
                        zIndexOffset={zIndex} // <-- APLICACIÓN DEL FIX
                    >
                        <Tooltip direction="top" offset={[0, -42]} opacity={1} className="font-bold text-xs uppercase bg-slate-800 text-white border-0 shadow-lg px-2 py-1 rounded">
                            {obj.name}
                        </Tooltip>

                        <Popup className="custom-popup">
                            <div className="flex flex-col min-w-[280px]">
                                <div className={`p-3 rounded-t-lg flex justify-between items-start ${audit.status === 'CRITICAL' ? 'bg-red-600 text-white' : audit.status === 'RETENTION' ? 'bg-orange-500 text-white' : audit.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
                                    <div><h3 className="font-black text-sm uppercase flex items-center gap-2"><Building2 size={14}/> {obj.name}</h3><p className="text-[10px] opacity-90">{obj.address}</p></div>
                                    <div className="text-right"><span className="text-xl font-black">{audit.present}/{audit.req}</span><p className="text-[9px] uppercase font-bold opacity-80">Presentes</p></div>
                                </div>
                                <div className="max-h-[250px] overflow-y-auto bg-white p-1">
                                    {audit.guards.length === 0 ? <div className="text-center py-4 text-xs text-slate-400 italic">Sin actividad registrada en este filtro</div> : 
                                    audit.guards.map((s: any) => (
                                        <div key={s.id} className={`p-2 mb-1 rounded border-l-4 flex justify-between items-center group hover:bg-slate-50 transition-colors ${s.isUnassigned || s.isSlaGap ? 'border-red-500 bg-red-50/50' : s.isRetention ? 'border-orange-500 bg-orange-50/50' : s.isPresent ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300'}`}>
                                            <div className="flex-1"><p className="text-xs font-bold text-slate-800 flex items-center gap-1">{s.isUnassigned ? '🔴 VACANTE' : s.employeeName}{s.isRetention && <Clock size={10} className="text-orange-600 animate-pulse"/>}</p><p className="text-[10px] text-slate-500 font-mono">{s.shiftDateObj?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} - {s.endDateObj?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p></div>
                                            <div className="flex gap-1">{(s.isUnassigned || s.isSlaGap || s.isRetention) && onOpenResolution ? (<button onClick={() => onOpenResolution(s)} className="p-1.5 bg-rose-100 text-rose-600 rounded hover:bg-rose-600 hover:text-white" title="Resolver"><Siren size={12}/></button>) : s.isPresent ? (<div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold flex items-center gap-1"><CheckCircle size={10}/> ON</div>) : (<span className="text-[9px] text-slate-400 font-bold uppercase">{s.statusText}</span>)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
