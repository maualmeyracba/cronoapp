
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Building2, Clock, Siren, CheckCircle, LogOut, AlertTriangle, AlertOctagon, Shield, FileText } from 'lucide-react';

const iconUrl = (color: string) => `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`;
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png';

const getIcon = (status: string) => {
    let color = 'grey'; 
    if (status === 'PRIORIDAD') color = 'red';
    else if (status === 'RETENIDO') color = 'orange';
    else if (status === 'ACTIVO') color = 'green';
    else if (status === 'PENDIENTE') color = 'blue';
    return new L.Icon({ iconUrl: iconUrl(color), shadowUrl: shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
};

const MapShiftCard = ({ shift, onAction, onOpenResolution, onOpenCheckout }: any) => {
    const { isRetention, hasPendingIssue, isPresent, isCompleted, employeeName, statusText, isUnassigned, isCriticallyLate, isSlaGap, isReported } = shift;
    let borderClass = 'border-slate-200'; let bgClass = 'bg-white';
    
    if (isSlaGap) { borderClass = 'border-red-600'; bgClass = 'bg-red-50'; }
    else if (isReported) { borderClass = 'border-violet-400'; bgClass = 'bg-violet-50'; }
    else if (isUnassigned) { borderClass = 'border-red-500'; bgClass = 'bg-red-50'; }
    else if (isRetention) { borderClass = 'border-orange-500'; bgClass = 'bg-orange-50'; }
    else if (isCriticallyLate) { borderClass = 'border-rose-600'; bgClass = 'bg-rose-50'; }
    else if (hasPendingIssue) { borderClass = 'border-rose-400'; bgClass = 'bg-rose-50'; }
    else if (isPresent) { borderClass = 'border-emerald-500'; bgClass = 'bg-emerald-50'; }

    return (
        <div className={`mb-2 p-2 rounded border-l-4 shadow-sm ${borderClass} ${bgClass}`}>
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-[11px] truncate max-w-[120px] block" title={employeeName}>{isUnassigned ? (isSlaGap ? 'VACANTE CONTRATO' : 'VACANTE') : employeeName}</span>
                {isRetention && <span className="bg-orange-600 text-white px-1 rounded text-[9px] font-bold animate-pulse">RET</span>}
                {!isRetention && <span className="text-[9px] font-bold uppercase text-slate-500">{statusText}</span>}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mb-1 flex items-center gap-1"><Shield size={10} className="text-slate-400"/> {shift.positionName || 'Puesto General'}</div>
            <div className="flex justify-between text-slate-500 text-[10px] mb-2 font-mono"><span>{new Date(shift.shiftDateObj).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span><span>➜</span><span>{new Date(shift.endDateObj).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
            <div className="flex gap-1">
                {isReported ? (<div className="w-full text-center text-[9px] font-bold text-violet-600 py-1 bg-violet-100 rounded flex items-center justify-center gap-1"><FileText size={10}/> EN PLANIFICACIÓN</div>) : 
                (hasPendingIssue || isUnassigned || isSlaGap) && !isPresent ? (<button onClick={() => onOpenResolution(shift)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-1 shadow-sm animate-pulse"><Siren size={10}/> Resolver</button>) : 
                (<>{!isPresent ? (<button onClick={() => onAction('CHECKIN', shift.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-1 shadow-sm"><CheckCircle size={10}/> Entrar</button>) : (<button onClick={() => onOpenCheckout(shift)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-1 shadow-sm"><LogOut size={10}/> Salir</button>)}<button onClick={() => onAction('NOVEDAD', shift.id)} className="px-2 bg-white border border-slate-300 hover:bg-amber-50 hover:text-amber-600 text-slate-500 rounded flex items-center justify-center transition-colors"><AlertTriangle size={10}/></button></>)}
            </div>
        </div>
    );
};

const MapUpdater = ({ center }: { center: [number, number] }) => { const map = useMap(); useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]); return null; };

export default function OperacionesMap({ center, objectives, processedData, onAction, onOpenResolution, onOpenCheckout }: any) {
    const mapMarkers = useMemo(() => {
        if (!objectives || !processedData) return [];
        const now = new Date(); const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
        return objectives.map((obj: any) => {
            const shifts = processedData.filter((s: any) => {
                const isMatch = s.objectiveId === obj.id || s.objectiveName === obj.name;
                if (!isMatch) return false;
                if (s.isCompleted || s.isReported) return false; 
                if (s.isPresent || s.isRetention || s.hasPendingIssue || s.isCriticallyLate || s.isSlaGap) return true;
                if (s.shiftDateObj <= endOfToday) return true;
                return false;
            });
            let status = 'SIN_ACTIVIDAD';
            if (shifts.length > 0) {
                status = 'PENDIENTE';
                const priorityShift = shifts.find((s:any) => s.hasPendingIssue || s.isSlaGap);
                const workingShift = shifts.find((s:any) => s.isPresent);
                if (priorityShift) status = 'PRIORIDAD'; else if (workingShift) status = 'ACTIVO';
            }
            const lat = obj.lat || obj.latitude || -31.4201; const lng = obj.lng || obj.longitude || -64.1888;
            return { id: obj.id, name: obj.name, lat, lng, status, shifts };
        }).filter(Boolean);
    }, [objectives, processedData]);

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapUpdater center={center} />
            {mapMarkers.map((marker: any) => (
                <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={getIcon(marker.status)}>
                    <Popup className="custom-popup" minWidth={350}>
                        <div className="p-1 max-h-[600px] overflow-y-auto custom-scrollbar">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2 mb-2 text-xs uppercase tracking-wider"><Building2 size={12} className="text-slate-400"/> {marker.name}</h4>
                            {marker.shifts.length === 0 ? (<div className="text-center py-2"><p className="text-[10px] text-slate-400 italic">Sin actividad operativa pendiente</p></div>) : (marker.shifts.map((s: any) => (<MapShiftCard key={s.id} shift={s} onAction={onAction} onOpenResolution={onOpenResolution} onOpenCheckout={onOpenCheckout} />)))}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
