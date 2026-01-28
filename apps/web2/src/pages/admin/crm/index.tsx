import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, 
    query, orderBy, where, arrayUnion, serverTimestamp 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Toaster, toast } from 'sonner';
import { 
    Users, Building2, MapPin, Phone, Mail, Search, Plus, 
    Trash2, Briefcase, Send, Edit2, Save, X, ExternalLink, User,
    Bug, Crosshair, Navigation, CreditCard, Hash, ShieldCheck, Globe, Map, 
    Link as LinkIcon, Calculator, FileText, Calendar, TrendingUp, Printer, 
    CheckCircle, AlertCircle,
    Package
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = "AIzaSyA0Nl6OOJI8swRVQ8uzAKpPHdE2zvEscOE"; 

// --- DATOS DE LA EMPRESA ---
const COMPANY_DATA = {
    name: "BACAR SA",
    cuit: "30-66813497-8",
    address: "Santiago del Estero 263 - Córdoba",
    logo: "https://bacar.com.ar/wp-content/uploads/2020/06/logo-bacar.png"
};

// ✅ HELPER GLOBAL (Movido aquí para evitar errores de referencia)
const formatMoney = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

export default function CRMPage() {
    const router = useRouter();
    const [view, setView] = useState('list');
    const [activeTab, setActiveTab] = useState('INFO');
    const [currentUserName, setCurrentUserName] = useState("Cargando...");

    // Datos
    const [clients, setClients] = useState<any[]>([]);
    const [filteredClients, setFilteredClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientServices, setClientServices] = useState<any[]>([]);
    const [clientQuotes, setClientQuotes] = useState<any[]>([]);
    
    // UI
    const [searchTerm, setSearchTerm] = useState('');
    const [historyNote, setHistoryNote] = useState('');
    const [showDebug, setShowDebug] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState<any>({});
    
    // Edición Sedes + Maps
    const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
    const [tempObjective, setTempObjective] = useState<any>({});
    const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mapsLoaded, setMapsLoaded] = useState(false);
    const autocompleteService = useRef<any>(null);
    const geocoderService = useRef<any>(null); 

    // Edición Contactos
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [tempContact, setTempContact] = useState<any>({});

    // VISOR DE COTIZACIÓN
    const [viewingQuote, setViewingQuote] = useState<any>(null);

    // --- EFFECT: CARGA INICIAL ---
    useEffect(() => {
        if (router.query.clientId && clients.length > 0) {
            const target = clients.find(c => c.id === router.query.clientId);
            if (target) {
                setSelectedClient(target);
                setView('detail');
                setActiveTab('COTIZACIONES'); 
            }
        }
    }, [router.query.clientId, clients]);

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
        script.onload = () => { setMapsLoaded(true); initServices(); };
        document.head.appendChild(script);
    }, []);

    const initServices = () => {
        if (!window.google) return;
        try {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
            geocoderService.current = new window.google.maps.Geocoder();
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            setCurrentUserName(user ? (user.displayName || user.email || "Usuario") : "No Logueado");
        });
        fetchClients();
    }, []);

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
        if (!selectedClient) return;
        if (activeTab === 'SERVICIOS') loadServices(selectedClient.id);
        if (activeTab === 'COTIZACIONES') loadQuotes(selectedClient.id);
    }, [selectedClient, activeTab]);

    // --- DATA FETCHING ---
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
            const normalized = allDocs.map((s:any) => ({
                id: s.id, name: s.objectiveName || s.name || 'Servicio',
                start: s.startDate || s.start_date || s.fechaInicio || s.createdAt,
                status: s.status || 'Activo', positions: s.positions || [], _raw: s
            }));
            setClientServices(normalized);
        } catch (e) { console.error(e); }
    };

    const loadQuotes = async (clientId: string) => {
        try {
            const q = query(collection(db, 'quotes'), where('clientId', '==', clientId), orderBy('createdAt', 'desc'));
            const s = await getDocs(q);
            setClientQuotes(s.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e: any) { 
            console.error("Error quotes", e); 
            if(e.code === 'failed-precondition') toast.error("Falta índice en Firebase.");
        }
    };

    const irACotizador = () => {
        if (!selectedClient || !selectedClient.id) {
            toast.error("Error: Cliente no seleccionado.");
            return;
        }
        router.push({ pathname: '/admin/cotizador', query: { clientId: selectedClient.id } });
    };

    // --- 🖨️ PDF GENERATOR ENGINE (V20 - Corregido y Optimizado) ---
    const printQuote = (quote: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return toast.error("Permite los pop-ups para imprimir");

        // 1. Servicios
        let serviciosHtml = '';
        if (quote.params.servicios && Array.isArray(quote.params.servicios)) {
            serviciosHtml = quote.params.servicios.map((s:any) => `
                <div style="margin-bottom:8px; border-bottom:1px solid #000; padding-bottom:5px;">
                    <strong style="color:#000; font-size:12px;">${s.nombre}</strong><br/>
                    <span style="font-size:11px; color:#000;">
                        ${s.cantidad} Puesto/s • ${s.horas} Hs Diarias • 
                        ${quote.params.modalidad === 'evento' ? `Evento (${quote.params.diasEvento} días)` : `Mensual (${s.dias?.length || 7} días/sem)`}
                    </span>
                </div>
            `).join('');
        } else {
            serviciosHtml = `<div style="color:red">Error: Formato de servicio antiguo.</div>`;
        }

        // 2. Items
        const itemsHtml = quote.items?.map((i:any) => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ccc;">${i.nombre}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ccc; text-align: right;">${i.tipo === 'fijo' ? 'Único' : 'Mensual'}</td>
            </tr>
        `).join('') || '<tr><td colspan="2" style="padding:10px; color:#000; font-style:italic;">Incluidos en tarifa plana</td></tr>';

        // 3. Dotación (Sin Precio)
        const mixHtml = quote.team?.map((t:any) => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ccc; color: #000;"><strong>${t.cantidad}x</strong> ${t.categoria}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ccc; text-align: right; color: #000;">Cobertura Garantizada</td>
            </tr>
        `).join('') || '';

        // 4. Proyección Financiera
        let proyeccionHtml = '';
        if (quote.proyeccion && Array.isArray(quote.proyeccion)) {
            const rows = quote.proyeccion.map((p: any) => `
                <tr>
                    <td style="padding:6px; border-bottom:1px solid #ccc;">${p.mes}</td>
                    <td style="padding:6px; border-bottom:1px solid #ccc; text-align:center;">${Math.round(p.horas)} hs</td>
                    <td style="padding:6px; border-bottom:1px solid #ccc; text-align:right; font-family:monospace; font-weight:bold;">${formatMoney(p.venta)}</td>
                </tr>
            `).join('');

            proyeccionHtml = `
                <div class="section-title" style="margin-top:20px;">4. Plan de Pagos y Proyección (Ajuste Inflacionario)</div>
                <table style="width:100%; border:1px solid #000;">
                    <thead style="background:#f0f0f0;">
                        <tr>
                            <th style="text-align:left; padding:5px; font-size:10px; color:#000;">PERIODO</th>
                            <th style="text-align:center; padding:5px; font-size:10px; color:#000;">HORAS PRESTADAS</th>
                            <th style="text-align:right; padding:5px; font-size:10px; color:#000;">VALOR CUOTA (+IVA)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        }

        // Cálculos Header
        const precioMes1 = quote.results.precioVentaMes1 || quote.proyeccion?.[0]?.venta || 0;
        const totalHoras = quote.results.horasTotales || 0;
        const mesesDivisor = quote.params.modalidad === 'evento' ? 1 : (quote.params.mesesContrato || 1);
        const promedioMensual = (quote.results.valorTotalContrato || quote.results.precioVentaTotal) / mesesDivisor;

        printWindow.document.write(`
            <html>
            <head>
                <title>Cotización #${quote.id.slice(0,6)}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #000; max-width: 900px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D32F2F; padding-bottom: 20px; margin-bottom: 40px; }
                    .company h1 { font-size: 28px; color: #D32F2F; margin: 0; text-transform: uppercase; font-weight: 900; }
                    .company p { font-size: 12px; color: #000; margin: 2px 0; font-weight: bold; }
                    .client-box { border: 2px solid #000; padding: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; background: #fff; }
                    .client-box h3 { margin:0 0 5px 0; font-size:10px; text-transform:uppercase; color:#D32F2F; }
                    .client-box p { margin:0; font-size:14px; font-weight:bold; }
                    .section-title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #000; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-top: 30px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                    th { text-align: left; background: #000; color: #fff; padding: 8px; text-transform: uppercase; font-size: 10px; }
                    .kpi-summary { display: flex; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #ccc; }
                    .kpi-item { flex: 1; text-align: center; }
                    .kpi-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; display: block; margin-bottom: 5px; }
                    .kpi-value { font-size: 18px; font-weight: 900; color: #D32F2F; display: block; }
                    .footer { margin-top: 60px; font-size: 10px; text-align: center; color: #000; border-top: 1px solid #000; padding-top: 20px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company">
                        <h1>${COMPANY_DATA.name}</h1>
                        <p>${COMPANY_DATA.address}</p>
                        <p>CUIT: ${COMPANY_DATA.cuit}</p>
                    </div>
                    <div style="text-align:right">
                        <h2 style="margin:0; font-size:18px;">PROPUESTA COMERCIAL</h2>
                        <p style="font-size:12px; margin:0">#${quote.id.slice(0,6).toUpperCase()}</p>
                        <p style="font-size:12px; margin:0">Fecha: ${new Date(quote.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="client-box">
                    <div>
                        <h3>Cliente</h3>
                        <p>${selectedClient.name}</p>
                        <p style="font-weight:normal; font-size:12px;">${selectedClient.taxId || 'CUIT Pendiente'}</p>
                    </div>
                    <div style="text-align:right">
                        <h3>Objetivo</h3>
                        <p>${quote.params.cliente}</p>
                        <p style="font-weight:normal; font-size:12px;">${selectedClient.address || ''}</p>
                    </div>
                </div>

                <div class="kpi-summary">
                    <div class="kpi-item">
                        <span class="kpi-label">Valor Cuota Inicial (Mes 1)</span>
                        <span class="kpi-value">${formatMoney(precioMes1)}</span>
                    </div>
                    <div class="kpi-item">
                        <span class="kpi-label">Promedio Mensual</span>
                        <span class="kpi-value">${formatMoney(promedioMensual)}</span>
                    </div>
                    <div class="kpi-item">
                        <span class="kpi-label">Total Horas Contrato</span>
                        <span class="kpi-value" style="color:#000">${new Intl.NumberFormat('es-AR').format(totalHoras)} HS</span>
                    </div>
                </div>

                <div class="section-title">1. Alcance del Servicio</div>
                ${serviciosHtml}

                <div class="section-title">2. Estructura Operativa</div>
                <table>
                    <thead><tr><th>Recurso</th><th style="text-align:right">Detalle</th></tr></thead>
                    <tbody>
                        ${mixHtml}
                        ${itemsHtml}
                    </tbody>
                </table>

                ${proyeccionHtml}

                <div class="totals-container">
                    <div class="totals-box">
                        <div class="total-row"><span>Costo Financiero (${quote.params.diasPago} días)</span> <span>${formatMoney(quote.results.costoFinanciero || 0)}</span></div>
                        <div class="total-row"><span>Impuestos (IIBB+Tasas)</span> <span>Incluidos</span></div>
                        <div class="final-total"><span>TOTAL CONTRATO</span> <span>${formatMoney(quote.results.valorTotalContrato || quote.results.precioVentaTotal)}</span></div>
                        <p style="font-size:10px; color:#000; margin-top:5px; font-weight:bold;">+ IVA (21%)</p>
                    </div>
                </div>

                <div class="footer">
                    <p>Este documento es una propuesta comercial y no representa una factura fiscal.</p>
                    <p>${COMPANY_DATA.name} - Seguridad Privada Inteligente</p>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // --- MAPS HELPERS ---
    const handleGoogleSearch = (text: string) => {
        const coords = extractCoordinates(text);
        if (coords) {
            setTempObjective({ ...tempObjective, lat: coords.lat, lng: coords.lng, coords: `${coords.lat},${coords.lng}`, address: text.includes("http") ? "Ubicación Pegada (Link)" : "Coordenadas Manuales" });
            toast.success(`Coordenadas: ${coords.lat}, ${coords.lng}`);
            setAddressSuggestions([]); setShowSuggestions(false); return;
        }
        setTempObjective({ ...tempObjective, address: text });
        if (!text || text.length < 3 || !mapsLoaded || !autocompleteService.current) { setAddressSuggestions([]); return; }
        const request = { input: text, componentRestrictions: { country: 'ar' } };
        autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                setAddressSuggestions(predictions); setShowSuggestions(true);
            } else { setAddressSuggestions([]); }
        });
    };

    const extractCoordinates = (text: string) => {
        let match = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (match) return { lat: match[1], lng: match[2] };
        match = text.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/); if (match) return { lat: match[1], lng: match[2] };
        match = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (match) return { lat: match[1], lng: match[2] };
        match = text.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/); if (match) return { lat: match[1], lng: match[2] };
        return null;
    };

    const selectGoogleAddress = (item: any) => {
        if (!geocoderService.current) return;
        geocoderService.current.geocode({ placeId: item.place_id }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
                const loc = results[0].geometry.location;
                setTempObjective({ ...tempObjective, address: item.description, lat: loc.lat().toString(), lng: loc.lng().toString(), coords: `${loc.lat()},${loc.lng()}` });
                setAddressSuggestions([]); setShowSuggestions(false); toast.success("Ubicación encontrada");
            } else { toast.error("Error coordenadas"); }
        });
    };

    // --- CRUD ---
    const handleSaveInfo = async () => {
        if (!infoForm.name) return toast.error('Nombre requerido');
        try {
            await updateDoc(doc(db, 'clients', selectedClient.id), infoForm);
            setSelectedClient({ ...selectedClient, ...infoForm });
            setIsEditingInfo(false); toast.success('Guardado');
        } catch (e) { toast.error('Error'); }
    };

    const saveObjective = async () => {
        try {
            let updated = [...(selectedClient.objetivos || [])];
            const finalObj = { ...tempObjective, lat: tempObjective.lat || '', lng: tempObjective.lng || '' };
            if (editingObjectiveId === 'NEW') updated.push({ ...finalObj, id: Date.now().toString() });
            else updated = updated.map(o => o.id === editingObjectiveId ? { ...o, ...finalObj } : o);
            await updateDoc(doc(db, 'clients', selectedClient.id), { objetivos: updated });
            setSelectedClient({ ...selectedClient, objetivos: updated });
            setEditingObjectiveId(null); setTempObjective({}); toast.success('Sede guardada');
        } catch (e) { toast.error('Error'); }
    };

    const deleteObjective = async (id: string) => {
        if (!confirm('¿Borrar?')) return;
        const updated = selectedClient.objetivos.filter((o:any) => o.id !== id);
        await updateDoc(doc(db, 'clients', selectedClient.id), { objetivos: updated });
        setSelectedClient({ ...selectedClient, objetivos: updated });
    };

    const saveContact = async () => {
        try {
            let updated = [...(selectedClient.contactos || [])];
            if (editingContactId === 'NEW') updated.push({ ...tempContact, id: Date.now().toString() });
            else updated = updated.map(c => c.id === editingContactId ? { ...c, ...tempContact } : c);
            await updateDoc(doc(db, 'clients', selectedClient.id), { contactos: updated });
            setSelectedClient({ ...selectedClient, contactos: updated });
            setEditingContactId(null); toast.success('Contacto guardado');
        } catch (e) { toast.error('Error'); }
    };

    const deleteContact = async (id: string) => {
        if (!confirm('¿Borrar?')) return;
        const updated = selectedClient.contactos.filter((c:any) => c.id !== id);
        await updateDoc(doc(db, 'clients', selectedClient.id), { contactos: updated });
        setSelectedClient({ ...selectedClient, contactos: updated });
    };

    const handleCreateNew = async () => {
        const newClient = { name: 'Nuevo Cliente', status: 'ACTIVE', createdAt: new Date().toISOString(), objetivos: [], contactos: [] };
        const ref = await addDoc(collection(db, 'clients'), newClient);
        fetchClients();
        setSelectedClient({ id: ref.id, ...newClient });
        setInfoForm({ id: ref.id, ...newClient });
        setIsEditingInfo(true);
        setView('detail');
    };

    const handleAddHistory = async () => {
        if (!historyNote) return;
        const note = { date: new Date().toISOString(), note: historyNote, user: currentUserName };
        await updateDoc(doc(db, 'clients', selectedClient.id), { historial: arrayUnion(note) });
        setSelectedClient({ ...selectedClient, historial: [...(selectedClient.historial || []), note] });
        setHistoryNote('');
    };

    const getStatusColor = (s: string) => s === 'INACTIVE' ? 'bg-slate-100 text-slate-500' : s === 'SUSPENDED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

    return (
        <DashboardLayout>
            <Head><title>CRM | Gestión de Clientes</title></Head>
            <Toaster position="top-center" />
            <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in">
                
                {/* HEADER */}
                <header className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black uppercase text-slate-800">CRM</h1>
                        <p className="text-[10px] text-indigo-500 mt-1">Usuario Activo: <b>{currentUserName}</b></p>
                    </div>
                    {view === 'detail' && selectedClient ? (
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={irACotizador} 
                                className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold uppercase flex gap-2 items-center hover:bg-emerald-200 transition-colors shadow-sm"
                            >
                                <Calculator size={16}/> Cotizar
                            </button>
                            <button onClick={() => setView('list')} className="text-slate-500 font-bold text-xs uppercase px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50">Volver</button>
                        </div>
                    ) : (
                        <button onClick={handleCreateNew} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex gap-2"><Plus size={16}/> Nuevo Cliente</button>
                    )}
                </header>

                {/* VISTA LISTA */}
                {view === 'list' && (
                    <div className="space-y-4">
                        <div className="bg-white p-3 rounded-xl border flex items-center gap-2"><Search className="text-slate-400" size={18}/><input className="w-full bg-transparent outline-none font-bold text-sm" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {filteredClients.map(c => (
                                <div key={c.id} onClick={() => { setSelectedClient(c); setInfoForm({}); setIsEditingInfo(false); setActiveTab('INFO'); setView('detail'); }} className="bg-white p-5 rounded-2xl border hover:shadow-md cursor-pointer transition-all">
                                    <div className="flex justify-between mb-2"><Building2 className="text-indigo-500"/><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${getStatusColor(c.status)}`}>{c.status || 'Activo'}</span></div>
                                    <h3 className="font-black text-lg truncate">{c.name}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase">{c.fantasyName || '-'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VISTA DETALLE */}
                {view === 'detail' && selectedClient && (
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-1/3 bg-white p-6 rounded-3xl border h-fit text-center">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Building2 size={40}/></div>
                            <h2 className="text-xl font-black">{selectedClient.name}</h2>
                            <p className="text-sm font-bold text-slate-500">{selectedClient.taxId || 'CUIT No Informado'}</p>
                            <div className="mt-6 space-y-3 text-left">
                                <div className="flex gap-3 items-center text-xs text-slate-600"><Mail size={14}/> {selectedClient.email || '-'}</div>
                                <div className="flex gap-3 items-center text-xs text-slate-600"><Phone size={14}/> {selectedClient.phone || '-'}</div>
                                <div className="flex gap-3 items-center text-xs text-slate-600"><MapPin size={14}/> {selectedClient.city || selectedClient.address || '-'}</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-3xl border overflow-hidden flex flex-col min-h-[600px]">
                            <div className="flex border-b overflow-x-auto bg-slate-50/50">
                                {['INFO', 'COTIZACIONES', 'SEDES', 'CONTACTOS', 'SERVICIOS', 'HISTORIAL'].map(t => (
                                    <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-4 text-xs font-black uppercase border-b-2 whitespace-nowrap transition-colors ${activeTab === t ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t}</button>
                                ))}
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto">
                                
                                {activeTab === 'INFO' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-sm uppercase text-slate-700">Ficha de Cliente</h3>
                                            {!isEditingInfo ? (
                                                <button onClick={() => { setInfoForm({...selectedClient}); setIsEditingInfo(true); }} className="text-indigo-600 text-xs font-bold uppercase flex gap-1 hover:underline"><Edit2 size={12}/> Editar</button>
                                            ) : (
                                                <div className="flex gap-2"><button onClick={() => setIsEditingInfo(false)} className="text-slate-400 text-xs font-bold">Cancelar</button><button onClick={handleSaveInfo} className="text-emerald-600 text-xs font-bold">Guardar</button></div>
                                            )}
                                        </div>
                                        {isEditingInfo ? (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                                <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Razón Social</label><input className="w-full p-2 border rounded font-bold" value={infoForm.name||''} onChange={e=>setInfoForm({...infoForm, name:e.target.value})}/></div>
                                                <div><label className="text-[10px] font-bold text-slate-400">CUIT</label><input className="w-full p-2 border rounded" value={infoForm.taxId||''} onChange={e=>setInfoForm({...infoForm, taxId:e.target.value})}/></div>
                                                <div><label className="text-[10px] font-bold text-slate-400">Teléfono</label><input className="w-full p-2 border rounded" value={infoForm.phone||''} onChange={e=>setInfoForm({...infoForm, phone:e.target.value})}/></div>
                                                <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Email</label><input className="w-full p-2 border rounded" value={infoForm.email||''} onChange={e=>setInfoForm({...infoForm, email:e.target.value})}/></div>
                                                <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400">Dirección</label><input className="w-full p-2 border rounded" value={infoForm.address||''} onChange={e=>setInfoForm({...infoForm, address:e.target.value})}/></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Razón Social</label><p className="font-bold text-sm">{selectedClient.name}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Fantasía</label><p className="font-bold text-sm">{selectedClient.fantasyName || '-'}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">CUIT</label><p className="font-bold text-sm">{selectedClient.taxId || '-'}</p></div>
                                                    <div className="p-3 bg-white border rounded-xl"><label className="text-[9px] font-black text-slate-400 uppercase">Tipo</label><p className="font-bold text-sm">{selectedClient.clientType === 'FISICA' ? 'Persona Física' : 'Empresa'}</p></div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-4 items-center"><MapPin className="text-slate-400"/><p className="font-bold text-sm">{selectedClient.address || 'Sin dirección'}</p></div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'COTIZACIONES' && (
                                    <div className="space-y-4 animate-in slide-in-from-right-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-sm uppercase text-slate-700">Historial de Propuestas</h3>
                                            <button 
                                                type="button"
                                                onClick={irACotizador} 
                                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex gap-2 items-center hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <Plus size={14}/> Nueva Cotización
                                            </button>
                                        </div>

                                        {clientQuotes.length > 0 ? (
                                            <div className="overflow-hidden border rounded-xl">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b">
                                                        <tr>
                                                            <th className="p-3">Fecha</th>
                                                            <th className="p-3">Servicio</th>
                                                            <th className="p-3 text-right">Monto Total</th>
                                                            <th className="p-3 text-center">Estado</th>
                                                            <th className="p-3 text-right">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {clientQuotes.map((q:any) => (
                                                            <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="p-3 font-medium flex items-center gap-2"><Calendar size={14} className="text-slate-400"/> {q.createdAt ? new Date(q.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                                                                <td className="p-3 text-slate-600">{q.params?.servicios ? `${q.params.servicios.length} Servicios` : `${q.params?.puestos || 1} Puesto`} • {q.params?.modalidad}</td>
                                                                <td className="p-3 text-right font-black text-slate-800">{formatMoney(q.results?.valorTotalContrato || q.results?.precioVentaTotal)}</td>
                                                                <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${q.status === 'APROBADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{q.status || 'Borrador'}</span></td>
                                                                <td className="p-3 text-right">
                                                                    <button 
                                                                        onClick={() => setViewingQuote(q)}
                                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white border rounded hover:bg-indigo-50" title="Ver / Imprimir"
                                                                    >
                                                                        <FileText size={14}/>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                                                <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                                <h3 className="text-sm font-bold text-slate-600">No hay cotizaciones</h3>
                                                <p className="text-xs text-slate-400 mt-1">Crea una nueva propuesta comercial para este cliente.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'SEDES' && (
                                    <div className="space-y-4">
                                        <button onClick={() => { setEditingObjectiveId('NEW'); setTempObjective({ name: '', address: '' }); }} className="text-indigo-600 text-xs font-bold uppercase hover:underline">+ Agregar Sede</button>
                                        {editingObjectiveId === 'NEW' && (
                                            <div className="p-4 bg-indigo-50 border rounded-xl space-y-3 relative">
                                                <input autoFocus placeholder="Nombre Sede" className="w-full p-2 rounded border" value={tempObjective.name} onChange={e => setTempObjective({...tempObjective, name: e.target.value})}/>
                                                <div className="relative">
                                                    <input placeholder="🔍 Buscar dirección o pegar link de Maps..." className="w-full p-2 rounded border border-indigo-200 focus:border-indigo-500 outline-none transition-colors" value={tempObjective.address} onChange={e => handleGoogleSearch(e.target.value)} onFocus={() => tempObjective.address?.length > 2 && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}/>
                                                    {showSuggestions && (<ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in">{addressSuggestions.map((item:any) => (<li key={item.place_id} onClick={() => selectGoogleAddress(item)} className="p-3 text-xs hover:bg-indigo-50 cursor-pointer border-b flex items-start gap-2"><MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0"/><div><span className="font-bold block">{item.structured_formatting?.main_text || item.description}</span><span className="text-[10px] text-slate-500">{item.structured_formatting?.secondary_text}</span></div></li>))}</ul>)}
                                                </div>
                                                <div className="flex gap-2"><input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lat || ''} onChange={e => setTempObjective({...tempObjective, lat: e.target.value})}/><input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lng || ''} onChange={e => setTempObjective({...tempObjective, lng: e.target.value})}/></div>
                                                <div className="flex justify-end gap-2"><button onClick={() => setEditingObjectiveId(null)} className="px-3 py-1 bg-white rounded text-xs">Cancelar</button><button onClick={saveObjective} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Guardar</button></div>
                                            </div>
                                        )}
                                        {selectedClient.objetivos?.map((obj:any) => (
                                            <div key={obj.id} className="p-3 border rounded-xl bg-slate-50">
                                                {editingObjectiveId === obj.id ? (
                                                    <div className="space-y-2">
                                                        <input className="w-full p-2 rounded border font-bold" value={tempObjective.name} onChange={e => setTempObjective({...tempObjective, name: e.target.value})}/>
                                                        <div className="relative"><input className="w-full p-2 rounded border" value={tempObjective.address} onChange={e => handleGoogleSearch(e.target.value)} onFocus={() => tempObjective.address?.length > 2 && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}/>{showSuggestions && (<ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in">{addressSuggestions.map((item:any) => (<li key={item.place_id} onClick={() => selectGoogleAddress(item)} className="p-3 text-xs hover:bg-indigo-50 cursor-pointer border-b flex items-start gap-2"><MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0"/><div><span className="font-bold block">{item.structured_formatting?.main_text || item.description}</span><span className="text-[10px] text-slate-500">{item.structured_formatting?.secondary_text}</span></div></li>))}</ul>)}</div>
                                                        <div className="flex gap-2"><input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lat || ''} onChange={e => setTempObjective({...tempObjective, lat: e.target.value})}/><input className="w-1/2 p-2 rounded border text-xs font-mono" value={tempObjective.lng || ''} onChange={e => setTempObjective({...tempObjective, lng: e.target.value})}/></div>
                                                        <div className="flex justify-end gap-2"><button onClick={() => setEditingObjectiveId(null)} className="text-xs">Cancelar</button><button onClick={saveObjective} className="text-xs text-emerald-600 font-bold">Guardar</button></div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-800">{obj.name}</div>
                                                            <div className="text-xs text-slate-500">{obj.address}</div>
                                                            {(obj.lat && obj.lng) && <div className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1"><Crosshair size={10}/> GPS Google OK</div>}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {(obj.lat && obj.lng) && <a href={`http://googleusercontent.com/maps.google.com/maps?q=${obj.lat},${obj.lng}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border rounded text-indigo-500 hover:bg-indigo-50"><ExternalLink size={14}/></a>}
                                                            <button onClick={() => { setEditingObjectiveId(obj.id); setTempObjective(obj); }} className="p-2 bg-white border rounded hover:text-indigo-600"><Edit2 size={14}/></button>
                                                            <button onClick={() => deleteObjective(obj.id)} className="p-2 bg-white border rounded hover:text-rose-500"><Trash2 size={14}/></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'CONTACTOS' && (
                                    <div className="space-y-4">
                                        <button onClick={() => { setEditingContactId('NEW'); setTempContact({}); }} className="text-indigo-600 text-xs font-bold uppercase hover:underline">+ Agregar Contacto</button>
                                        {editingContactId === 'NEW' && (
                                            <div className="p-4 bg-indigo-50 border rounded-xl space-y-3">
                                                <div className="grid grid-cols-2 gap-2"><input autoFocus placeholder="Nombre" className="p-2 rounded border" value={tempContact.name||''} onChange={e => setTempContact({...tempContact, name: e.target.value})}/><input placeholder="Cargo" className="p-2 rounded border" value={tempContact.role||''} onChange={e => setTempContact({...tempContact, role: e.target.value})}/></div>
                                                <input placeholder="Email / Tel" className="w-full p-2 rounded border" value={tempContact.phone||''} onChange={e => setTempContact({...tempContact, phone: e.target.value})}/>
                                                <div className="flex justify-end gap-2"><button onClick={() => setEditingContactId(null)} className="px-3 py-1 bg-white rounded text-xs">Cancelar</button><button onClick={saveContact} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Guardar</button></div>
                                            </div>
                                        )}
                                        {selectedClient.contactos?.map((c:any) => (
                                            <div key={c.id} className="p-4 bg-white border rounded-xl flex justify-between items-center">
                                                {editingContactId === c.id ? (
                                                    <div className="flex-1 space-y-2 mr-4"><input className="w-full p-1 border rounded" value={tempContact.name} onChange={e=>setTempContact({...tempContact, name:e.target.value})}/><input className="w-full p-1 border rounded" value={tempContact.phone} onChange={e=>setTempContact({...tempContact, phone:e.target.value})}/><div className="flex justify-end gap-2"><button onClick={()=>setEditingContactId(null)} className="text-xs">Cancelar</button><button onClick={saveContact} className="text-xs text-emerald-600 font-bold">Guardar</button></div></div>
                                                ) : (
                                                    <><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black"><User size={14}/></div><div><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-400">{c.role} • {c.phone}</p></div></div><div className="flex gap-2"><button onClick={()=>{setEditingContactId(c.id); setTempContact(c)}} className="text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button><button onClick={()=>deleteContact(c.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button></div></>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

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
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'HISTORIAL' && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 space-y-4 mb-4">
                                            {selectedClient.historial?.map((h:any, i:number) => (
                                                <div key={i} className="flex gap-4"><div className="w-2 h-2 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div><div><p className="text-xs text-slate-400 font-mono">{new Date(h.date).toLocaleString()} - <b>{h.user}</b></p><p className="text-sm font-medium">{h.note}</p></div></div>
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

            {/* ✅ MODAL DE VISUALIZACIÓN DE COTIZACIÓN (MEJORADO UX V3) */}
            {viewingQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* HEADER MODAL */}
                        <div className="p-6 border-b flex justify-between items-start bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-indigo-600"/> Detalle de Propuesta</h2>
                                <p className="text-xs text-slate-500 mt-1 font-mono">ID: {viewingQuote.id}</p>
                            </div>
                            <button onClick={() => setViewingQuote(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>

                        {/* BODY MODAL */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* KPI PRINCIPALES */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Configuración del Servicio</p>
                                    <p className="text-sm font-black text-indigo-900">
                                        {viewingQuote.params?.servicios ? `${viewingQuote.params.servicios.length} Servicios` : `${viewingQuote.params?.puestos} Puestos`}
                                    </p>
                                    <p className="text-xs text-indigo-700">Duración: {viewingQuote.params?.mesesContrato} Meses</p>
                                </div>
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-right">
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Valor Total Contrato</p>
                                    <p className="text-2xl font-black text-emerald-700">{formatMoney(viewingQuote.results?.valorTotalContrato || viewingQuote.results?.precioVentaTotal)}</p>
                                    <p className="text-[9px] text-emerald-600 font-bold">+ IVA</p>
                                </div>
                            </div>

                            {/* DOTACIÓN (TABLA) */}
                            <div>
                                <h4 className="text-xs font-black uppercase text-slate-400 mb-3 border-b pb-1">Recursos Humanos</h4>
                                <div className="space-y-2">
                                    {viewingQuote.team?.map((t:any, i:number) => (
                                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white border w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold shadow-sm">{t.cantidad}x</div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{t.categoria}</p>
                                                    <p className="text-[10px] text-slate-500">Cobertura Operativa Garantizada</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TABLA DE PROYECCIÓN EN PREVISUALIZACIÓN */}
                            {viewingQuote.proyeccion && (
                                <div>
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-3 border-b pb-1">Resumen Proyección</h4>
                                    <div className="max-h-40 overflow-y-auto border rounded text-xs">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 font-bold sticky top-0"><tr><th className="p-2">Mes</th><th className="p-2 text-right">Valor Cuota</th></tr></thead>
                                            <tbody>{viewingQuote.proyeccion.map((p:any, i:number) => (<tr key={i}><td className="p-2 border-b">{p.mes}</td><td className="p-2 border-b text-right font-mono">{formatMoney(p.venta)}</td></tr>))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* FOOTER MODAL */}
                        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setViewingQuote(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg text-xs">Cerrar</button>
                            <button 
                                onClick={() => printQuote(viewingQuote)} 
                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-indigo-700 text-xs shadow-lg shadow-indigo-200"
                            >
                                <Printer size={16}/> Imprimir PDF Oficial
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
}