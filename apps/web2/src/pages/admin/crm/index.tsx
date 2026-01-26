import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, 
    query, orderBy, where, arrayUnion, serverTimestamp 
} from 'firebase/firestore';
// ✅ IMPORTACIONES DE AUTH
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Toaster, toast } from 'sonner';
import { 
    Users, Building2, MapPin, Phone, Mail, Search, Plus, 
    Trash2, Briefcase, Send, Edit2, Save, X, ExternalLink, User,
    Bug, Crosshair, Navigation, CreditCard, Hash, ShieldCheck, Globe, Map, Link as LinkIcon
} from 'lucide-react';

// 🔑 CONFIGURACIÓN GOOGLE MAPS (INTEGRADA)
const GOOGLE_MAPS_API_KEY = "AIzaSyA0Nl6OOJI8swRVQ8uzAKpPHdE2zvEscOE"; 

export default function CRMPage() {
    const [view, setView] = useState('list');
    const [activeTab, setActiveTab] = useState('INFO');
    
    // ✅ ESTADO VISUAL DEL USUARIO
    const [currentUserName, setCurrentUserName] = useState("Cargando...");

    // Datos
    const [clients, setClients] = useState<any[]>([]);
    const [filteredClients, setFilteredClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientServices, setClientServices] = useState<any[]>([]);
    
    // UI
    const [searchTerm, setSearchTerm] = useState('');
    const [historyNote, setHistoryNote] = useState('');
    const [showDebug, setShowDebug] = useState(false);
    
    // --- ESTADOS DE EDICIÓN ---
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState<any>({});
    
    // Edición Sedes + Google Maps
    const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
    const [tempObjective, setTempObjective] = useState<any>({});
    const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Estado de carga de Google Maps
    const [mapsLoaded, setMapsLoaded] = useState(false);
    const autocompleteService = useRef<any>(null);
    const geocoderService = useRef<any>(null); 

    // Edición Contactos
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [tempContact, setTempContact] = useState<any>({});

    // ✅ 1. CARGA DINÁMICA DE GOOGLE MAPS SCRIPT
    useEffect(() => {
        if (window.google && window.google.maps) {
            setMapsLoaded(true);
            initServices();
            return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            console.log("✅ Google Maps Script cargado correctamente.");
            setMapsLoaded(true);
            initServices();
        };

        script.onerror = (e) => {
            console.error("❌ Error cargando Google Maps Script", e);
            toast.error("Error cargando mapas. Verifique conexión.");
        };

        document.head.appendChild(script);
    }, []);

    const initServices = () => {
        if (!window.google) return;
        try {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
            geocoderService.current = new window.google.maps.Geocoder();
        } catch (error) {
            console.error("❌ Error inicializando servicios:", error);
        }
    };

    // ✅ DETECCIÓN DE USUARIO
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUserName(user.displayName || user.email || "Usuario Sin Nombre");
            } else {
                setCurrentUserName("No Logueado");
            }
        });
        return () => unsubscribe();
    }, []);

    // Cargas
    useEffect(() => { fetchClients(); }, []);

    useEffect(() => {
        if (!clients.length) return;
        const term = searchTerm.toLowerCase();
        setFilteredClients(clients.filter(c => 
            (c.name || '').toLowerCase().includes(term) || 
            (c.fantasyName || '').toLowerCase().includes(term) ||
            (c.taxId || '').includes(term)
        ));
    }, [searchTerm, clients]);

    useEffect(() => {
        if (selectedClient && activeTab === 'SERVICIOS') {
            loadServices(selectedClient.id);
        }
    }, [selectedClient, activeTab]);

    // ✅ AUDITORÍA
    const registrarAuditoria = async (accion: string, detalle: string) => {
        try {
            const auth = getAuth();
            const u = auth.currentUser;
            const nombreReal = u?.displayName || u?.email || "Usuario Desconocido";

            await addDoc(collection(db, 'audit_logs'), {
                timestamp: serverTimestamp(),
                actorUid: u?.uid || "unknown",
                actorName: nombreReal, 
                action: accion,
                module: 'CRM',
                details: detalle,
                metadata: { platform: 'web' }
            });
        } catch (error) {
            console.error("Error auditoría:", error);
        }
    };

    const fetchClients = async () => {
        try {
            const q = query(collection(db, 'clients'), orderBy('name'));
            const s = await getDocs(q);
            const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setClients(data);
            setFilteredClients(data);
        } catch (e) { console.error(e); }
    };

    const loadServices = async (clientId: string) => {
        try {
            const q1 = query(collection(db, 'servicios_sla'), where('clientId', '==', clientId));
            const s1 = await getDocs(q1);
            const allDocs = s1.docs.map(d => ({ id: d.id, ...d.data() }));
            
            if (allDocs.length === 0) {
                const q2 = query(collection(db, 'services'), where('clientId', '==', clientId));
                const s2 = await getDocs(q2);
                allDocs.push(...s2.docs.map(d => ({ id: d.id, ...d.data() })));
            }

            const normalizedServices = allDocs.map((s:any) => ({
                id: s.id,
                name: s.objectiveName || s.name || 'Servicio',
                start: s.startDate || s.start_date || s.fechaInicio || s.createdAt,
                status: s.status || 'Activo',
                positions: s.positions || [],
                _raw: s
            }));
            setClientServices(normalizedServices);
        } catch (e) { console.error(e); }
    };

    // --- 🚀 HELPER PARA EXTRAER COORDENADAS (REGEX AVANZADO) ---
    const extractCoordinates = (text: string) => {
        // 1. Patrón Standard URL (@lat,lng) -> Ejs: google.com/maps/...@ -31.42,-64.18
        let match = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) return { lat: match[1], lng: match[2] };

        // 2. Patrón "search/query" (?q=lat,lng)
        match = text.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) return { lat: match[1], lng: match[2] };

        // 3. Patrón "Data Param" (!3dlat!4dlng) -> Común en embeds y URLs largas
        match = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (match) return { lat: match[1], lng: match[2] };

        // 4. Patrón Raw (Pegar solo "-31.42, -64.18")
        match = text.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
        if (match) return { lat: match[1], lng: match[2] };

        return null;
    };

    // --- LÓGICA HÍBRIDA: AUTOCOMPLETE + MAGIC PASTE ---
    const handleGoogleSearch = (text: string) => {
        
        // 1. INTENTO DE EXTRACCIÓN DIRECTA (MAGIC PASTE)
        const coords = extractCoordinates(text);
        if (coords) {
            console.log("📍 Coordenadas extraídas manualmente/link:", coords);
            setTempObjective({
                ...tempObjective,
                lat: coords.lat,
                lng: coords.lng,
                coords: `${coords.lat},${coords.lng}`,
                address: text.includes("http") ? "Ubicación Pegada (Link)" : "Coordenadas Manuales"
            });
            
            toast.success(`Coordenadas detectadas: ${coords.lat}, ${coords.lng}`);
            setAddressSuggestions([]);
            setShowSuggestions(false);
            return; // 🛑 Cortamos aquí si detectamos coordenadas, no buscamos en Autocomplete
        }

        // 2. FLUJO NORMAL DE BÚSQUEDA POR TEXTO (AUTOCOMPLETE)
        setTempObjective({ ...tempObjective, address: text });

        if (!text || text.length < 3) {
            setAddressSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (!mapsLoaded || !autocompleteService.current) {
            return;
        }

        const request = {
            input: text,
            componentRestrictions: { country: 'ar' }, 
        };

        try {
            autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setAddressSuggestions(predictions);
                    setShowSuggestions(true);
                } else {
                    setAddressSuggestions([]);
                }
            });
        } catch (err) { console.error(err); }
    };

    const selectGoogleAddress = (item: any) => {
        if (!geocoderService.current) return;
        
        geocoderService.current.geocode({ placeId: item.place_id }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
                const location = results[0].geometry.location;
                const lat = location.lat().toString();
                const lng = location.lng().toString();
                
                setTempObjective({
                    ...tempObjective,
                    address: item.description, 
                    lat: lat,
                    lng: lng,
                    coords: `${lat},${lng}`
                });
                setAddressSuggestions([]);
                setShowSuggestions(false);
                toast.success("Ubicación exacta encontrada");
            } else {
                toast.error("Error obteniendo coordenadas");
            }
        });
    };

    // --- ACCIONES CRUD ---
    const handleSaveInfo = async () => {
        if (!infoForm.name) return toast.error('Nombre/Razón Social requerido');
        try {
            const updated = { ...selectedClient, ...infoForm };
            await updateDoc(doc(db, 'clients', selectedClient.id), infoForm);
            await registrarAuditoria('UPDATE_CLIENT_INFO', `Actualizó información de: ${updated.name}`);
            setSelectedClient(updated);
            setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
            setIsEditingInfo(false);
            toast.success('Información guardada');
        } catch (e) { toast.error('Error'); }
    };

    const saveObjective = async () => {
        try {
            let updatedObjectives = [...(selectedClient.objetivos || [])];
            
            // Prioridad a lo manual si se editó, sino lo que trajo Google (Link o Search)
            const finalLat = tempObjective.lat || '';
            const finalLng = tempObjective.lng || '';
            const finalCoords = (finalLat && finalLng) ? `${finalLat},${finalLng}` : (tempObjective.coords || '');

            const finalObj = {
                ...tempObjective,
                lat: finalLat,
                lng: finalLng,
                coords: finalCoords
            };

            let actionDetail = '';

            if (editingObjectiveId === 'NEW') {
                updatedObjectives.push({ ...finalObj, id: Date.now().toString() });
                actionDetail = `Creó sede: ${finalObj.name}`;
            } else {
                updatedObjectives = updatedObjectives.map(obj => 
                    obj.id === editingObjectiveId ? { ...obj, ...finalObj } : obj
                );
                actionDetail = `Editó sede: ${finalObj.name}`;
            }

            await updateDoc(doc(db, 'clients', selectedClient.id), { objetivos: updatedObjectives });
            await registrarAuditoria('UPDATE_OBJECTIVES', `${actionDetail} para ${selectedClient.name}`);

            setSelectedClient({ ...selectedClient, objetivos: updatedObjectives });
            setEditingObjectiveId(null);
            setTempObjective({});
            setAddressSuggestions([]);
            toast.success('Sede guardada');
        } catch (e) { toast.error('Error'); }
    };

    const deleteObjective = async (objId: string) => {
        if (!confirm('¿Borrar sede?')) return;
        const target = selectedClient.objetivos.find((o:any) => o.id === objId);
        const updated = selectedClient.objetivos.filter((o:any) => o.id !== objId);
        await updateDoc(doc(db, 'clients', selectedClient.id), { objetivos: updated });
        await registrarAuditoria('DELETE_OBJECTIVE', `Eliminó sede: ${target?.name} de ${selectedClient.name}`);
        setSelectedClient({ ...selectedClient, objetivos: updated });
    };

    const saveContact = async () => {
        try {
            let updated = [...(selectedClient.contactos || [])];
            let actionDetail = '';
            if (editingContactId === 'NEW') {
                updated.push({ ...tempContact, id: Date.now().toString() });
                actionDetail = `Creó contacto: ${tempContact.name}`;
            } else {
                updated = updated.map(c => c.id === editingContactId ? { ...c, ...tempContact } : c);
                actionDetail = `Editó contacto: ${tempContact.name}`;
            }
            await updateDoc(doc(db, 'clients', selectedClient.id), { contactos: updated });
            await registrarAuditoria('UPDATE_CONTACTS', `${actionDetail} para ${selectedClient.name}`);
            setSelectedClient({ ...selectedClient, contactos: updated });
            setEditingContactId(null);
            toast.success('Contacto guardado');
        } catch (e) { toast.error('Error'); }
    };

    const deleteContact = async (cid: string) => {
        if (!confirm('¿Borrar?')) return;
        const target = selectedClient.contactos.find((c:any) => c.id === cid);
        const updated = selectedClient.contactos.filter((c:any) => c.id !== cid);
        await updateDoc(doc(db, 'clients', selectedClient.id), { contactos: updated });
        await registrarAuditoria('DELETE_CONTACT', `Eliminó contacto: ${target?.name} de ${selectedClient.name}`);
        setSelectedClient({ ...selectedClient, contactos: updated });
    };

    const handleCreateNew = async () => {
        const newClient = { name: 'Nuevo Cliente', status: 'ACTIVE', createdAt: new Date().toISOString(), objetivos: [], contactos: [] };
        const ref = await addDoc(collection(db, 'clients'), newClient);
        await registrarAuditoria('CREATE_CLIENT', `Alta de cliente inicial`);
        fetchClients();
        const created = { id: ref.id, ...newClient };
        setSelectedClient(created);
        setInfoForm(created);
        setIsEditingInfo(true);
        setView('detail');
    };

    const handleAddHistory = async () => {
        if (!historyNote) return;
        const auth = getAuth();
        const u = auth.currentUser;
        const userName = u?.displayName || u?.email || "Usuario";
        const note = { date: new Date().toISOString(), note: historyNote, user: userName };
        await updateDoc(doc(db, 'clients', selectedClient.id), { historial: arrayUnion(note) });
        await registrarAuditoria('ADD_HISTORY', `Nota historial: ${historyNote} en ${selectedClient.name}`);
        setSelectedClient({ ...selectedClient, historial: [...(selectedClient.historial || []), note] });
        setHistoryNote('');
    };

    // --- HELPERS VISUALES ---
    const getStatusColor = (status: string) => {
        if (status === 'INACTIVE') return 'bg-slate-100 text-slate-500';
        if (status === 'SUSPENDED') return 'bg-amber-100 text-amber-700';
        return 'bg-emerald-100 text-emerald-700';
    };

    return (
        <DashboardLayout>
            <Head><title>CRM | Ficha Técnica</title></Head>
            <Toaster position="top-center" />
            <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in">
                
                {/* HEADER */}
                <header className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black uppercase text-slate-800">CRM</h1>
                        <p className="text-[10px] text-indigo-500 mt-1">Usuario Activo: <b>{currentUserName}</b></p>
                    </div>
                    {view === 'list' ? (
                        <button onClick={handleCreateNew} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex gap-2"><Plus size={16}/> Nuevo</button>
                    ) : (
                        <button onClick={() => setView('list')} className="text-slate-500 font-bold text-xs uppercase">Volver</button>
                    )}
                </header>

                {/* VISTA: LISTA */}
                {view === 'list' && (
                    <div className="space-y-4">
                        <div className="bg-white p-3 rounded-xl border flex items-center gap-2">
                            <Search className="text-slate-400" size={18}/>
                            <input className="w-full bg-transparent outline-none font-bold text-sm" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {filteredClients.map(c => (
                                <div key={c.id} onClick={() => { setSelectedClient(c); setInfoForm({}); setIsEditingInfo(false); setActiveTab('INFO'); setView('detail'); }} className="bg-white p-5 rounded-2xl border hover:shadow-md cursor-pointer transition-all">
                                    <div className="flex justify-between mb-2">
                                        <Building2 className="text-indigo-500"/>
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${getStatusColor(c.status)}`}>{c.status === 'ACTIVE' || !c.status ? 'Activo' : c.status}</span>
                                    </div>
                                    <h3 className="font-black text-lg truncate">{c.name}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase">{c.fantasyName}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VISTA: DETALLE */}
                {view === 'detail' && selectedClient && (
                    <div className="flex flex-col lg:flex-row gap-6">
                        
                        {/* SIDEBAR KPI */}
                        <div className="w-full lg:w-1/3 bg-white p-6 rounded-3xl border h-fit">
                            <div className="text-center mb-6">
                                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Building2 size={40}/></div>
                                <h2 className="text-xl font-black">{selectedClient.name}</h2>
                                <p className="text-sm font-bold text-slate-500">{selectedClient.taxId || 'CUIT No Informado'}</p>
                                <span className={`mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(selectedClient.status)}`}>
                                    {selectedClient.status === 'ACTIVE' || !selectedClient.status ? 'Activo' : selectedClient.status}
                                </span>
                            </div>
                            <div className="space-y-3 text-xs font-bold text-slate-600">
                                <div className="p-3 bg-slate-50 rounded-xl flex gap-3"><Mail size={16}/> {selectedClient.email || '-'}</div>
                                <div className="p-3 bg-slate-50 rounded-xl flex gap-3"><Phone size={16}/> {selectedClient.phone || '-'}</div>
                                <div className="p-3 bg-slate-50 rounded-xl flex gap-3">
                                    <MapPin size={16}/> 
                                    {selectedClient.city ? `${selectedClient.city}, ${selectedClient.province}` : (selectedClient.address || '-')}
                                </div>
                            </div>
                        </div>

                        {/* CONTENIDO PRINCIPAL */}
                        <div className="flex-1 bg-white rounded-3xl border overflow-hidden flex flex-col">
                            <div className="flex border-b overflow-x-auto">
                                {['INFO', 'SEDES', 'CONTACTOS', 'SERVICIOS', 'HISTORIAL'].map(t => (
                                    <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-4 text-xs font-black uppercase border-b-2 ${activeTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>{t}</button>
                                ))}
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto min-h-[400px]">
                                
                                {/* 1. PESTAÑA INFO (ESTRUCTURA NUEVA V18) */}
                                {activeTab === 'INFO' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-sm uppercase">Ficha de Cliente</h3>
                                            {!isEditingInfo ? (
                                                <button onClick={() => { setInfoForm({...selectedClient}); setIsEditingInfo(true); }} className="text-indigo-600 text-xs font-bold uppercase flex gap-1 hover:underline"><Edit2 size={12}/> Editar</button>
                                            ) : (
                                                <div className="flex gap-2"><button onClick={() => setIsEditingInfo(false)} className="text-slate-400 text-xs font-bold">Cancelar</button><button onClick={handleSaveInfo} className="text-emerald-600 text-xs font-bold">Guardar</button></div>
                                            )}
                                        </div>

                                        {isEditingInfo ? (
                                            <div className="space-y-6 animate-in fade-in">
                                                {/* A. IDENTIFICACIÓN */}
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <h4 className="text-[10px] font-black uppercase text-indigo-400 mb-3 flex items-center gap-2"><Building2 size={12}/> Identificación (Core)</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><label className="text-[10px] font-bold text-slate-400">Tipo de Cliente</label>
                                                            <select className="w-full p-2 border rounded font-bold text-xs" value={infoForm.clientType||'JURIDICA'} onChange={e=>setInfoForm({...infoForm, clientType:e.target.value})}>
                                                                <option value="JURIDICA">Persona Jurídica (Empresa)</option>
                                                                <option value="FISICA">Persona Física</option>
                                                            </select>
                                                        </div>
                                                        <div><label className="text-[10px] font-bold text-slate-400">CUIT / DNI</label><input className="w-full p-2 border rounded font-bold" value={infoForm.taxId||''} onChange={e=>setInfoForm({...infoForm, taxId:e.target.value})}/></div>
                                                        <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Razón Social (Legal)</label><input className="w-full p-2 border rounded font-bold" value={infoForm.name||''} onChange={e=>setInfoForm({...infoForm, name:e.target.value})}/></div>
                                                        <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Nombre Fantasía</label><input className="w-full p-2 border rounded font-bold" value={infoForm.fantasyName||''} onChange={e=>setInfoForm({...infoForm, fantasyName:e.target.value})}/></div>
                                                    </div>
                                                </div>

                                                {/* B. UBICACIÓN Y CONTACTO */}
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <h4 className="text-[10px] font-black uppercase text-indigo-400 mb-3 flex items-center gap-2"><MapPin size={12}/> Dirección Legal y Contacto</h4>
                                                    <div className="grid grid-cols-6 gap-3">
                                                        <div className="col-span-4"><label className="text-[10px] font-bold text-slate-400">Calle</label><input className="w-full p-2 border rounded" value={infoForm.street||''} onChange={e=>setInfoForm({...infoForm, street:e.target.value})}/></div>
                                                        <div className="col-span-1"><label className="text-[10px] font-bold text-slate-400">Número</label><input className="w-full p-2 border rounded" value={infoForm.number||''} onChange={e=>setInfoForm({...infoForm, number:e.target.value})}/></div>
                                                        <div className="col-span-1"><label className="text-[10px] font-bold text-slate-400">Piso/Dpto</label><input className="w-full p-2 border rounded" value={infoForm.floor||''} onChange={e=>setInfoForm({...infoForm, floor:e.target.value})}/></div>
                                                        
                                                        <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Código Postal</label><input className="w-full p-2 border rounded" value={infoForm.zipCode||''} onChange={e=>setInfoForm({...infoForm, zipCode:e.target.value})}/></div>
                                                        <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Localidad</label><input className="w-full p-2 border rounded" value={infoForm.city||''} onChange={e=>setInfoForm({...infoForm, city:e.target.value})}/></div>
                                                        <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Provincia</label><input className="w-full p-2 border rounded" value={infoForm.province||''} onChange={e=>setInfoForm({...infoForm, province:e.target.value})}/></div>

                                                        <div className="col-span-3 mt-2"><label className="text-[10px] font-bold text-slate-400">Email Principal</label><input className="w-full p-2 border rounded" value={infoForm.email||''} onChange={e=>setInfoForm({...infoForm, email:e.target.value})}/></div>
                                                        <div className="col-span-3 mt-2"><label className="text-[10px] font-bold text-slate-400">Teléfono</label><input className="w-full p-2 border rounded" value={infoForm.phone||''} onChange={e=>setInfoForm({...infoForm, phone:e.target.value})}/></div>
                                                    </div>
                                                </div>

                                                {/* C. DATOS FISCALES */}
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <h4 className="text-[10px] font-black uppercase text-indigo-400 mb-3 flex items-center gap-2"><CreditCard size={12}/> Datos Fiscales</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><label className="text-[10px] font-bold text-slate-400">Condición IVA</label>
                                                            <select className="w-full p-2 border rounded text-xs" value={infoForm.ivaCondition||'RI'} onChange={e=>setInfoForm({...infoForm, ivaCondition:e.target.value})}>
                                                                <option value="RI">Responsable Inscripto</option>
                                                                <option value="MONOTRIBUTO">Monotributo</option>
                                                                <option value="EXENTO">Exento</option>
                                                                <option value="CF">Consumidor Final</option>
                                                            </select>
                                                        </div>
                                                        <div><label className="text-[10px] font-bold text-slate-400">Ingresos Brutos (IIBB)</label><input className="w-full p-2 border rounded" value={infoForm.iibb||''} onChange={e=>setInfoForm({...infoForm, iibb:e.target.value})}/></div>
                                                    </div>
                                                </div>

                                                {/* D. SISTEMA */}
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <h4 className="text-[10px] font-black uppercase text-indigo-400 mb-3 flex items-center gap-2"><ShieldCheck size={12}/> Auditoría y Estado</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><label className="text-[10px] font-bold text-slate-400">Estado del Cliente</label>
                                                            <select className="w-full p-2 border rounded font-bold text-xs" value={infoForm.status||'ACTIVE'} onChange={e=>setInfoForm({...infoForm, status:e.target.value})}>
                                                                <option value="ACTIVE">Activo</option>
                                                                <option value="INACTIVE">Inactivo</option>
                                                                <option value="SUSPENDED">Suspendido</option>
                                                            </select>
                                                        </div>
                                                        <div><label className="text-[10px] font-bold text-slate-400">ID Interno</label><input className="w-full p-2 border rounded bg-slate-200 text-slate-500" value={selectedClient.id} disabled/></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* LECTURA: IDENTIFICACIÓN */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Razón Social</label><p className="font-bold text-sm">{selectedClient.name}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Fantasía</label><p className="font-bold text-sm">{selectedClient.fantasyName || '-'}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">CUIT</label><p className="font-bold text-sm">{selectedClient.taxId || '-'}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Tipo</label><p className="font-bold text-sm">{selectedClient.clientType === 'FISICA' ? 'Persona Física' : 'Persona Jurídica'}</p></div>
                                                </div>

                                                {/* LECTURA: UBICACIÓN */}
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b pb-1">Ubicación Legal</h4>
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-4 items-center">
                                                        <MapPin className="text-slate-400"/>
                                                        <div>
                                                            <p className="font-bold text-sm">
                                                                {selectedClient.street ? `${selectedClient.street} ${selectedClient.number || ''}` : (selectedClient.address || 'Sin dirección')}
                                                            </p>
                                                            {selectedClient.city && <p className="text-xs text-slate-500">{selectedClient.floor ? `Piso ${selectedClient.floor}, ` : ''}{selectedClient.city}, {selectedClient.province} (CP {selectedClient.zipCode})</p>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* LECTURA: FISCAL */}
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b pb-1">Datos Fiscales</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Condición IVA</label><p className="font-bold text-sm">{selectedClient.ivaCondition || '-'}</p></div>
                                                        <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Ingresos Brutos</label><p className="font-bold text-sm">{selectedClient.iibb || '-'}</p></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* --- SEDES CON GOOGLE MAPS AUTOCOMPLETE OFICIAL --- */}
                                {activeTab === 'SEDES' && (
                                    <div className="space-y-4">
                                        <button onClick={() => { setEditingObjectiveId('NEW'); setTempObjective({ name: '', address: '' }); }} className="text-indigo-600 text-xs font-bold uppercase hover:underline">+ Agregar Sede</button>
                                        
                                        {editingObjectiveId === 'NEW' && (
                                            <div className="p-4 bg-indigo-50 border rounded-xl space-y-3 relative">
                                                <input autoFocus placeholder="Nombre Sede" className="w-full p-2 rounded border" value={tempObjective.name} onChange={e => setTempObjective({...tempObjective, name: e.target.value})}/>
                                                <div className="relative">
                                                    <input 
                                                        placeholder="🔍 Buscar dirección o pegar link de Maps..." 
                                                        className="w-full p-2 rounded border border-indigo-200 focus:border-indigo-500 outline-none transition-colors" 
                                                        value={tempObjective.address} 
                                                        onChange={e => handleGoogleSearch(e.target.value)}
                                                        onFocus={() => tempObjective.address?.length > 2 && setShowSuggestions(true)}
                                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                                                    />
                                                    
                                                    {/* MENÚ DE SUGERENCIAS GOOGLE */}
                                                    {showSuggestions && (
                                                        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                                            {addressSuggestions.length > 0 ? (
                                                                addressSuggestions.map((item:any) => (
                                                                    <li key={item.place_id} onClick={() => selectGoogleAddress(item)} className="p-3 text-xs hover:bg-indigo-50 cursor-pointer border-b flex items-start gap-2">
                                                                        <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0"/>
                                                                        <div>
                                                                            <span className="font-bold block">{item.structured_formatting?.main_text || item.description}</span>
                                                                            <span className="text-[10px] text-slate-500">{item.structured_formatting?.secondary_text}</span>
                                                                        </div>
                                                                    </li>
                                                                ))
                                                            ) : (
                                                                <li className="p-3 text-xs text-slate-400 italic text-center border-b">
                                                                    {mapsLoaded ? "Sin resultados de Google" : "Cargando Google Maps..."}
                                                                </li>
                                                            )}
                                                            <li className="p-1 bg-slate-50 border-t flex justify-end">
                                                                <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3_hdpi.png" className="h-4 mr-2 opacity-50" alt="Powered by Google"/>
                                                            </li>
                                                        </ul>
                                                    )}
                                                </div>
                                                
                                                {/* SECCIÓN COORDENADAS AUTO-COMPLETADAS POR GOOGLE (EDITABLES) */}
                                                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                                                    <div className="flex items-center gap-2 mb-2 justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Globe size={12} className="text-emerald-600"/>
                                                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Coordenadas (Auto/Manual)</p>
                                                        </div>
                                                        {tempObjective.lat && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">¡OK!</span>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="w-1/2">
                                                            <label className="text-[9px] text-slate-400 font-bold block mb-1">LATITUD</label>
                                                            <input 
                                                                className="w-full p-2 rounded border text-xs font-mono focus:border-indigo-500" 
                                                                value={tempObjective.lat || ''} 
                                                                onChange={e => setTempObjective({...tempObjective, lat: e.target.value})}
                                                            />
                                                        </div>
                                                        <div className="w-1/2">
                                                            <label className="text-[9px] text-slate-400 font-bold block mb-1">LONGITUD</label>
                                                            <input 
                                                                className="w-full p-2 rounded border text-xs font-mono focus:border-indigo-500" 
                                                                value={tempObjective.lng || ''} 
                                                                onChange={e => setTempObjective({...tempObjective, lng: e.target.value})}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 mt-2 italic flex items-center gap-1">
                                                        <LinkIcon size={10}/> Tip: Pega un link de Google Maps arriba para extraer coordenadas automáticamente.
                                                    </p>
                                                </div>

                                                <div className="flex justify-end gap-2"><button onClick={() => setEditingObjectiveId(null)} className="px-3 py-1 bg-white rounded text-xs">Cancelar</button><button onClick={saveObjective} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Guardar</button></div>
                                            </div>
                                        )}

                                        {selectedClient.objetivos?.map((obj:any) => (
                                            <div key={obj.id} className="p-3 border rounded-xl bg-slate-50">
                                                {editingObjectiveId === obj.id ? (
                                                    <div className="space-y-2">
                                                        <input className="w-full p-2 rounded border font-bold" value={tempObjective.name} onChange={e => setTempObjective({...tempObjective, name: e.target.value})}/>
                                                        <div className="relative">
                                                            <input 
                                                                className="w-full p-2 rounded border" 
                                                                value={tempObjective.address} 
                                                                onChange={e => handleGoogleSearch(e.target.value)}
                                                                onFocus={() => tempObjective.address?.length > 2 && setShowSuggestions(true)}
                                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                            />
                                                            {showSuggestions && (
                                                                <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in">
                                                                    {addressSuggestions.map((item:any) => (
                                                                        <li key={item.place_id} onClick={() => selectGoogleAddress(item)} className="p-3 text-xs hover:bg-indigo-50 cursor-pointer border-b flex items-start gap-2">
                                                                            <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0"/>
                                                                            <div>
                                                                                <span className="font-bold block">{item.structured_formatting?.main_text || item.description}</span>
                                                                                <span className="text-[10px] text-slate-500">{item.structured_formatting?.secondary_text}</span>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lat || ''} onChange={e => setTempObjective({...tempObjective, lat: e.target.value})}/>
                                                            <input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lng || ''} onChange={e => setTempObjective({...tempObjective, lng: e.target.value})}/>
                                                        </div>

                                                        <div className="flex justify-end gap-2"><button onClick={() => setEditingObjectiveId(null)} className="text-xs">Cancelar</button><button onClick={saveObjective} className="text-xs text-emerald-600 font-bold">Guardar</button></div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-800">{obj.name}</div>
                                                            <div className="text-xs text-slate-500">{obj.address}</div>
                                                            {(obj.lat && obj.lng || obj.coords) && <div className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1"><Crosshair size={10}/> GPS Google OK</div>}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {(obj.lat && obj.lng || obj.coords) && <a href={`http://googleusercontent.com/maps.google.com/maps?q=${obj.coords || `${obj.lat},${obj.lng}`}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border rounded text-indigo-500 hover:bg-indigo-50"><ExternalLink size={14}/></a>}
                                                            <button onClick={() => { setEditingObjectiveId(obj.id); setTempObjective(obj); }} className="p-2 bg-white border rounded hover:text-indigo-600"><Edit2 size={14}/></button>
                                                            <button onClick={() => deleteObjective(obj.id)} className="p-2 bg-white border rounded hover:text-rose-500"><Trash2 size={14}/></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* CONTACTOS */}
                                {activeTab === 'CONTACTOS' && (
                                    <div className="space-y-4">
                                        <button onClick={() => { setEditingContactId('NEW'); setTempContact({}); }} className="text-indigo-600 text-xs font-bold uppercase hover:underline">+ Agregar Contacto</button>
                                        
                                        {editingContactId === 'NEW' && (
                                            <div className="p-4 bg-indigo-50 border rounded-xl space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input autoFocus placeholder="Nombre" className="p-2 rounded border" value={tempContact.name||''} onChange={e => setTempContact({...tempContact, name: e.target.value})}/>
                                                    <input placeholder="Cargo" className="p-2 rounded border" value={tempContact.role||''} onChange={e => setTempContact({...tempContact, role: e.target.value})}/>
                                                </div>
                                                <input placeholder="Email / Tel" className="w-full p-2 rounded border" value={tempContact.phone||''} onChange={e => setTempContact({...tempContact, phone: e.target.value})}/>
                                                <div className="flex justify-end gap-2"><button onClick={() => setEditingContactId(null)} className="px-3 py-1 bg-white rounded text-xs">Cancelar</button><button onClick={saveContact} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Guardar</button></div>
                                            </div>
                                        )}

                                        {selectedClient.contactos?.map((c:any) => (
                                            <div key={c.id} className="p-4 bg-white border rounded-xl flex justify-between items-center">
                                                {editingContactId === c.id ? (
                                                    <div className="flex-1 space-y-2 mr-4">
                                                        <input className="w-full p-1 border rounded" value={tempContact.name} onChange={e=>setTempContact({...tempContact, name:e.target.value})}/>
                                                        <input className="w-full p-1 border rounded" value={tempContact.phone} onChange={e=>setTempContact({...tempContact, phone:e.target.value})}/>
                                                        <div className="flex justify-end gap-2"><button onClick={()=>setEditingContactId(null)} className="text-xs">Cancelar</button><button onClick={saveContact} className="text-xs text-emerald-600 font-bold">Guardar</button></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black"><User size={14}/></div>
                                                            <div><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-400">{c.role} • {c.phone}</p></div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={()=>{setEditingContactId(c.id); setTempContact(c)}} className="text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                                                            <button onClick={()=>deleteContact(c.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* SERVICIOS */}
                                {activeTab === 'SERVICIOS' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between"><h3 className="font-bold text-sm uppercase">Servicios Activos</h3><button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-slate-300 flex gap-1 items-center hover:text-slate-500"><Bug size={12}/> Debug</button></div>
                                        {showDebug && <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl overflow-auto max-h-40">{JSON.stringify(clientServices, null, 2)}</div>}
                                        {clientServices.map(s => (
                                            <div key={s.id} className="p-4 border rounded-xl bg-slate-50/50">
                                                <div className="flex justify-between items-start">
                                                    <div><h4 className="font-black text-slate-800 uppercase">{s.name}</h4><p className="text-xs text-slate-500 font-medium mt-1">Inicio: {s.start ? new Date(s.start.seconds ? s.start.seconds * 1000 : s.start).toLocaleDateString() : '-'}</p></div>
                                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase">{s.status}</span>
                                                </div>
                                                {s.positions?.length > 0 && <div className="mt-2 pt-2 border-t flex gap-2 flex-wrap">{s.positions.map((p:any, i:number) => <span key={i} className="text-[10px] bg-white border px-2 py-1 rounded font-bold text-slate-600">{p.quantity}x {p.name}</span>)}</div>}
                                            </div>
                                        ))}
                                        {clientServices.length === 0 && <p className="text-center text-slate-400 text-xs py-8 border-2 border-dashed rounded-xl">No hay servicios.</p>}
                                    </div>
                                )}

                                {activeTab === 'HISTORIAL' && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 space-y-4 mb-4">
                                            {selectedClient.historial?.map((h:any, i:number) => (
                                                <div key={i} className="flex gap-4">
                                                    <div className="w-2 h-2 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
                                                    <div><p className="text-xs text-slate-400 font-mono">{new Date(h.date).toLocaleString()} - <b>{h.user}</b></p><p className="text-sm font-medium">{h.note}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-4 border-t"><input className="flex-1 bg-slate-50 border rounded-xl px-4 text-xs font-bold outline-none" placeholder="Nota..." value={historyNote} onChange={e => setHistoryNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddHistory()}/><button onClick={handleAddHistory} className="p-3 bg-indigo-600 text-white rounded-xl"><Send size={16}/></button></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}