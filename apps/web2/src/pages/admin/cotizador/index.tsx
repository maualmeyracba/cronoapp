import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { getAuth } from 'firebase/auth';
import { Toaster, toast } from 'sonner';
import { 
    Calculator, Settings, Sliders, MapPin, CalendarDays, Users, User, 
    Truck, Package, CalendarClock, Trash2, Printer, Save, AlertTriangle, 
    X, CheckCircle, ArrowLeft, Shield, Clock, ExternalLink, RefreshCw, Database,
    Car, Zap, Wifi, Radio, Plus, 
    // ✅ ÍCONOS AGREGADOS:
    Briefcase, DollarSign, ArrowRight, FileText
} from 'lucide-react';

export default function SmartCostingPage() {
    const router = useRouter();
    const { clientId } = router.query;
    const [step, setStep] = useState(1);

    // --- CONFIGURACIÓN ESTATICA (Provincial) ---
    const CONFIG_PROVINCIAL: any = {
        cba: { nombre: 'Córdoba', iibb: 4.75, zona_desfavorable: 0, flag: '🇦🇷' },
        bue: { nombre: 'Buenos Aires', iibb: 3.5, zona_desfavorable: 0, flag: '🇦🇷' },
        nqn: { nombre: 'Neuquén', iibb: 3.0, zona_desfavorable: 20, flag: '❄️' }, 
        sta: { nombre: 'Santa Fe', iibb: 4.5, zona_desfavorable: 0, flag: '🇦🇷' }
    };

    // --- DATOS MAESTROS (Se cargarán de DB o usarán estos por defecto) ---
    const [categoriasDb, setCategoriasDb] = useState<any[]>([
        { id: 'vig_gral', nombre: 'Vigilador General', basico: 980000, viatico: 250000 },
        { id: 'monitoreo', nombre: 'Operador de Monitoreo', basico: 1150000, viatico: 250000 }
    ]);

    const [catalogoOperativo, setCatalogoOperativo] = useState<any[]>([
        { nombre: 'Móvil Patrulla (Alquiler + Seguro)', costo: 550000, tipo: 'mensual', porPuesto: false, icon: 'Car' },
        { nombre: 'Combustible Est. (4 Tanques)', costo: 280000, tipo: 'mensual', porPuesto: false, icon: 'Zap' },
        { nombre: 'Moto 150cc (Ronda)', costo: 220000, tipo: 'mensual', porPuesto: false, icon: 'Zap' },
        { nombre: 'Tablet + App Reportes', costo: 35000, tipo: 'mensual', porPuesto: true, icon: 'Wifi' },
        { nombre: 'Dron de Vigilancia (Mensual)', costo: 180000, tipo: 'mensual', porPuesto: false, icon: 'Wifi' },
        { nombre: 'Equipo de Radio (Handy)', costo: 25000, tipo: 'mensual', porPuesto: true, icon: 'Radio' },
        { nombre: 'Garita Química (Alquiler)', costo: 85000, tipo: 'mensual', porPuesto: true, icon: 'Package' },
        { nombre: 'Instalación Cámaras (Setup Inicial)', costo: 450000, tipo: 'fijo', porPuesto: false, icon: 'Package' }, 
        { nombre: 'Flete / Logística Inicio', costo: 120000, tipo: 'fijo', porPuesto: false, icon: 'Car' },
    ]);

    // --- ESTADO MAESTRO ---
    const [q, setQ] = useState({
        cliente: 'Nuevo Prospecto',
        zona: 'cba',
        puestos: 1,
        horasDiarias: 24, 
        diasSemana: 7,    
        mesesContrato: 12, 
        
        // Variables Globales (Valores iniciales seguros)
        presentismo: 180000,
        cargasPatronales: 29.0, 
        art: 7.5,               
        seguroVida: 0.65,
        sindicato: 2.0,         
        provisionSAC: 8.33,     
        provisionVacaciones: 4.5, 
        previsionDespido: 2.0,  
        ausentismo: 5.0,        
        
        uniformeMensual: 45000, 
        equipamiento: 15000,    
        supervision: 8.0,       
        
        gastosEstructura: 12.0, 
        iibb: 4.75,             
        impuestoDebCred: 1.2,   
        margenDeseado: 18.0     
    });

    // Mix de Dotación
    const [teamMix, setTeamMix] = useState<any[]>([
        { id: 1, categoria: 'Vigilador General', cantidad: 1, basico: 980000, viatico: 250000 }
    ]);
    const [newRole, setNewRole] = useState({ categoria: '', cantidad: 1, basico: 0, viatico: 0 });

    // Items Adicionales
    const [itemsOperativos, setItemsOperativos] = useState<any[]>([]);
    const [newItem, setNewItem] = useState({ nombre: '', costo: 0, tipo: 'mensual', porPuesto: false });

    // UI States
    const [mostrarConfigCostos, setMostrarConfigCostos] = useState(false);
    const [mostrarCalculadoraSueldo, setMostrarCalculadoraSueldo] = useState(false);
    const [loadingEscalas, setLoadingEscalas] = useState(false);

    // KPI
    const [kpi, setKpi] = useState<any>({});

    // --- EFECTO 1: CARGAR ESCALAS HOMOLOGADAS DE FIREBASE ---
    useEffect(() => {
        const fetchEscalas = async () => {
            setLoadingEscalas(true);
            try {
                // Buscamos el puntero a la escala activa
                const pointerRef = doc(db, 'settings_laborales', 'current_cba');
                const pointerSnap = await getDoc(pointerRef);
                
                if (pointerSnap.exists()) {
                    const activeId = pointerSnap.data().ref;
                    const escalaRef = doc(db, 'settings_laborales', activeId);
                    const escalaSnap = await getDoc(escalaRef);
                    
                    if (escalaSnap.exists()) {
                        const data = escalaSnap.data();
                        
                        // 1. Actualizar Categorías
                        if(data.categories) setCategoriasDb(data.categories);
                        
                        // 2. Actualizar Variables Globales
                        if(data.globals) {
                            setQ(prev => ({
                                ...prev,
                                cargasPatronales: data.globals.cargasPatronales,
                                art: data.globals.art,
                                seguroVida: data.globals.seguroVida,
                                sindicato: data.globals.sindicato,
                                presentismo: data.globals.presentismo,
                                // noRemunerativo: data.globals.noRemunerativo // Opcional
                            }));
                        }
                        console.log("✅ Escalas cargadas desde Firebase:", data.name);
                    }
                } else {
                    console.log("⚠️ No se encontró configuración de escalas. Usando defaults.");
                }
            } catch (error) {
                console.error("Error obteniendo escalas:", error);
            } finally {
                setLoadingEscalas(false);
            }
        };
        
        fetchEscalas();
    }, []);

    // --- EFECTO 2: CARGAR CLIENTE SI VIENE DEL CRM ---
    useEffect(() => {
        if (clientId) {
            const loadClient = async () => {
                try {
                    const snap = await getDoc(doc(db, 'clients', clientId as string));
                    if (snap.exists()) {
                        const data = snap.data();
                        setQ(prev => ({ ...prev, cliente: data.name || '' }));
                    }
                } catch (e) { console.error(e); }
            };
            loadClient();
        }
    }, [clientId]);

    // --- EFECTO 3: CÁLCULOS AUTOMÁTICOS ---
    useEffect(() => {
        calculateMetrics();
    }, [q, itemsOperativos, teamMix]);

    // --- LÓGICA DE NEGOCIO ---
    const calculateMetrics = () => {
        // A. Horas Totales a Cubrir
        const horasTotalesPuestoMes = (q.horasDiarias * q.diasSemana * 4.33) * q.puestos; 
        
        // B. Costo Laboral Ponderado (Mix)
        let costoMasaSalarialTotalMix = 0;
        let personasEnMix = 0;

        teamMix.forEach(role => {
            const bruto = role.basico + q.presentismo;
            const cargas = bruto * ((q.cargasPatronales + q.art + q.seguroVida + q.sindicato) / 100);
            const baseProvisiones = bruto + cargas;
            const costoProvisiones = baseProvisiones * ((q.provisionSAC + q.provisionVacaciones + q.previsionDespido) / 100);
            const costoAusentismo = (bruto + cargas) * (q.ausentismo / 100);

            // Costo Mensual de UN guardia de este rol
            const costoMensualIndiv = bruto + cargas + role.viatico + costoProvisiones + costoAusentismo;
            
            costoMasaSalarialTotalMix += (costoMensualIndiv * role.cantidad);
            personasEnMix += role.cantidad;
        });

        // C. Dotación Técnica Necesaria
        const horasPromedioGuardia = 200; 
        const dotacionTeorica = horasTotalesPuestoMes / horasPromedioGuardia;
        const factorSeguridad = 1 + ((q.ausentismo + 5) / 100); 
        const dotacionRealNecesaria = Math.ceil(dotacionTeorica * factorSeguridad * 10) / 10;

        // D. Proyección de Costo Laboral
        // Si el usuario puso 1 persona en el mix, pero necesita 4.2, usamos el promedio del mix para proyectar.
        const costoPromedioMix = personasEnMix > 0 ? (costoMasaSalarialTotalMix / personasEnMix) : 0;
        const costoLaboralFinal = costoPromedioMix * dotacionRealNecesaria;

        // E. Costo Operativo
        const costoUniformes = q.uniformeMensual * dotacionRealNecesaria;
        const costoEquipamiento = q.equipamiento * dotacionRealNecesaria;
        
        let costoAdicionalesMensualizado = 0;
        itemsOperativos.forEach(item => {
            let valor = item.costo;
            if (item.porPuesto) valor = valor * q.puestos;
            if (item.tipo === 'fijo') {
                valor = valor / (q.mesesContrato > 0 ? q.mesesContrato : 12);
            }
            costoAdicionalesMensualizado += valor;
        });

        const costoSupervision = costoLaboralFinal * (q.supervision / 100);
        
        // F. Totales
        const costoDirectoTotal = costoLaboralFinal + costoUniformes + costoEquipamiento + costoSupervision + costoAdicionalesMensualizado;
        
        // G. Precio Venta
        const denominator = 1 - ((q.gastosEstructura + q.iibb + q.impuestoDebCred + q.margenDeseado) / 100);
        let precioVentaTotal = 0;
        if (denominator > 0) precioVentaTotal = costoDirectoTotal / denominator;

        setKpi({
            horasTotales: Math.round(horasTotalesPuestoMes),
            dotacion: dotacionRealNecesaria,
            costoPromedioGuardia: costoPromedioMix,
            costoLaboralTotal: costoLaboralFinal,
            costoOperativoTotal: costoUniformes + costoEquipamiento + costoSupervision + costoAdicionalesMensualizado,
            costoDirectoTotal,
            precioVentaTotal,
            precioHora: precioVentaTotal / horasTotalesPuestoMes,
            breakEven: costoDirectoTotal / (1 - ((q.gastosEstructura + q.iibb + q.impuestoDebCred) / 100))
        });
    };

    // --- FUNCIONES AUXILIARES ---
    const handleInputChange = (field: string, value: any) => {
        setQ(prev => ({ ...prev, [field]: parseFloat(value) || value }));
    };

    const seleccionarCategoria = (e: any) => {
        const cat = categoriasDb.find(c => c.id === e.target.value);
        if (cat) {
            setNewRole({ ...newRole, categoria: cat.nombre, basico: cat.basico, viatico: cat.viatico });
        }
    };

    const agregarRolAlMix = () => {
        if (newRole.categoria) {
            setTeamMix([...teamMix, { ...newRole, id: Date.now() }]);
        } else {
            toast.error("Seleccione una categoría");
        }
    };

    const agregarItemOperativo = () => {
        if (newItem.nombre && newItem.costo > 0) {
            setItemsOperativos([...itemsOperativos, { ...newItem, id: Date.now() }]);
            setNewItem({ nombre: '', costo: 0, tipo: 'mensual', porPuesto: false });
        }
    };

    const eliminarItem = (id: number) => {
        setItemsOperativos(itemsOperativos.filter(i => i.id !== id));
    };

    const cargarPresetOperativo = (e: any) => {
        // ✅ CORREGIDO: Usamos catalogoOperativo (estado) en lugar de CATALOGO_OPERATIVO
        const item = catalogoOperativo.find(i => i.nombre === e.target.value);
        if(item) setNewItem({ nombre: item.nombre, costo: item.costo, tipo: item.tipo, porPuesto: item.porPuesto });
    };

    const formatMoney = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

    // --- 🚀 FUNCIÓN DE INICIALIZACIÓN DE DB (PLAN B) ---
    const inicializarBaseDeDatos = async () => {
        const confirmar = confirm("¿Está seguro? Esto sobreescribirá la configuración de escalas salariales con los valores por defecto de Enero 2026.");
        if (!confirmar) return;

        try {
            toast.loading("Inicializando base de datos...");
            
            // 1. Escala Maestra SUVICO
            const escalaSuvico = {
                name: "SUVICO - Córdoba (Vigente)",
                code: "suvico_cba",
                lastUpdate: new Date(),
                validFrom: "2026-01-01",
                validTo: "2026-03-31",
                globals: {
                    cargasPatronales: 29.0, art: 7.5, seguroVida: 0.65, sindicato: 2.0,
                    presentismo: 180000, noRemunerativo: 0
                },
                categories: [
                    { id: "vig_gral", nombre: "Vigilador General", basico: 980000, viatico: 250000, responsabilidad: 0 },
                    { id: "monitor", nombre: "Operador de Monitoreo", basico: 1150000, viatico: 250000, responsabilidad: 50000 },
                    { id: "jefe", nombre: "Jefe de Servicio", basico: 1350000, viatico: 300000, responsabilidad: 150000 },
                    { id: "drone", nombre: "Piloto Dron (Especial)", basico: 1500000, viatico: 300000, responsabilidad: 100000 }
                ]
            };

            // 2. Guardar en Firestore
            await setDoc(doc(db, 'settings_laborales', 'suvico_cba_2026'), escalaSuvico);
            await setDoc(doc(db, 'settings_laborales', 'current_cba'), { ref: 'suvico_cba_2026', updatedAt: serverTimestamp() });

            // 3. Recargar estado local
            setCategoriasDb(escalaSuvico.categories);
            setQ(prev => ({
                ...prev,
                cargasPatronales: escalaSuvico.globals.cargasPatronales,
                art: escalaSuvico.globals.art,
                seguroVida: escalaSuvico.globals.seguroVida,
                sindicato: escalaSuvico.globals.sindicato,
                presentismo: escalaSuvico.globals.presentismo
            }));

            toast.dismiss();
            toast.success("✅ Base de Datos Inicializada Correctamente");
        } catch (error: any) {
            console.error(error);
            toast.dismiss();
            toast.error("Error: " + error.message);
        }
    };

    const guardarCotizacion = async () => {
        try {
            const auth = getAuth();
            const data = {
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.email || 'unknown',
                client: q.cliente,
                params: q,
                items: itemsOperativos,
                team: teamMix,
                results: kpi
            };
            await addDoc(collection(db, 'quotes'), data);
            toast.success("Cotización guardada");
        } catch (e) { toast.error("Error al guardar"); }
    };

    return (
        <DashboardLayout>
            <Head><title>Smart Costing | Seguridad Privada</title></Head>
            <Toaster position="top-center" />
            
            <div className="max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in">
                
                {/* HEADER */}
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                                <Calculator size={24} />
                            </span>
                            Cotizador de Servicios
                        </h1>
                        <p className="text-slate-500 mt-2 ml-14">Ingeniería de costos, dotación y rentabilidad.</p>
                    </div>
                    {clientId && (
                        <button onClick={() => router.push('/admin/crm')} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex gap-2">
                            <ArrowLeft size={16}/> Volver al CRM
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* WIZARD IZQUIERDO */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* STEPPER */}
                        <div className="flex items-center justify-between mb-6 px-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center gap-2 cursor-pointer" onClick={() => setStep(i)}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step === i ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : step > i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        {step > i ? <CheckCircle size={14}/> : i}
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold hidden sm:block ${step === i ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {i === 1 ? 'Servicio' : i === 2 ? 'RRHH Mix' : i === 3 ? 'Operativo' : 'Financiero'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* PASO 1: SERVICIO */}
                        {step === 1 && (
                            <div className="card-step animate-in slide-in-from-right-4">
                                <h3 className="step-title"><Briefcase className="text-indigo-500"/> Definición del Servicio</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="label-costo">Cliente / Objetivo</label><input type="text" value={q.cliente} onChange={e => handleInputChange('cliente', e.target.value)} className="input-costo" /></div>
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                        <label className="label-costo text-amber-800 flex items-center gap-1"><Clock size={12}/> Contrato (Meses)</label>
                                        <input type="number" min="1" value={q.mesesContrato} onChange={e => handleInputChange('mesesContrato', e.target.value)} className="input-costo border-amber-200 focus:border-amber-500 font-bold" />
                                        <p className="text-[10px] text-amber-600 mt-1">* Usado para amortizar costos fijos.</p>
                                    </div>
                                    <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 grid grid-cols-3 gap-4">
                                        <div><label className="label-costo text-indigo-800">Puestos</label><input type="number" min="1" value={q.puestos} onChange={e => handleInputChange('puestos', e.target.value)} className="input-costo border-indigo-200" /></div>
                                        <div>
                                            <label className="label-costo text-indigo-800">Horas/Día</label>
                                            <select value={q.horasDiarias} onChange={e => handleInputChange('horasDiarias', e.target.value)} className="input-costo border-indigo-200">
                                                <option value="24">24 Hs</option><option value="12">12 Hs</option><option value="8">8 Hs</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-costo text-indigo-800">Días/Semana</label>
                                            <select value={q.diasSemana} onChange={e => handleInputChange('diasSemana', e.target.value)} className="input-costo border-indigo-200">
                                                <option value="7">Lunes a Lunes</option><option value="6">Lun a Sáb</option><option value="5">Lun a Vie</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PASO 2: RRHH MIX (CON BOTÓN DE CONFIGURACIÓN DE ESCALAS) */}
                        {step === 2 && (
                            <div className="card-step animate-in slide-in-from-right-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="step-title mb-0"><Users className="text-indigo-500"/> Dotación y Convenio</h3>
                                    <button onClick={() => setMostrarCalculadoraSueldo(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex gap-2">
                                        <Settings size={14}/> Config. Escalas
                                    </button>
                                </div>

                                {/* CONSTRUCTOR DE EQUIPO */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Definir Mix de Perfiles</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-4">
                                            <label className="label-costo">Categoría</label>
                                            <select onChange={seleccionarCategoria} className="input-costo bg-white">
                                                <option value="">{loadingEscalas ? "Cargando..." : "-- Seleccionar --"}</option>
                                                {categoriasDb.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3"><label className="label-costo">Básico ($)</label><input type="number" value={newRole.basico} onChange={e => setNewRole({...newRole, basico: parseFloat(e.target.value)})} className="input-costo" /></div>
                                        <div className="md:col-span-3"><label className="label-costo">Viático ($)</label><input type="number" value={newRole.viatico} onChange={e => setNewRole({...newRole, viatico: parseFloat(e.target.value)})} className="input-costo" /></div>
                                        <div className="md:col-span-2"><label className="label-costo">Cant.</label><input type="number" min="1" value={newRole.cantidad} onChange={e => setNewRole({...newRole, cantidad: parseInt(e.target.value)})} className="input-costo text-center" /></div>
                                    </div>
                                    <button onClick={agregarRolAlMix} className="w-full mt-3 bg-slate-800 text-white p-2 rounded-lg text-sm hover:bg-slate-700 flex justify-center items-center gap-2"><CheckCircle size={16}/> Agregar al Equipo</button>
                                </div>

                                <div className="space-y-2 mb-6">
                                    {teamMix.map(role => (
                                        <div key={role.id} className="flex justify-between items-center p-3 bg-white border border-indigo-100 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">{role.cantidad}x</div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{role.categoria}</p>
                                                    <p className="text-[10px] text-slate-500">Básico: {formatMoney(role.basico)} + Viático: {formatMoney(role.viatico)}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setTeamMix(teamMix.filter(r => r.id !== role.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    {teamMix.length === 0 && <p className="text-center text-xs text-red-400 italic">Agrega al menos un perfil para calcular el costo.</p>}
                                </div>

                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                    <h4 className="text-xs font-bold text-amber-700 uppercase mb-3 flex items-center gap-1"><AlertTriangle size={12}/> Variables Globales (%)</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div><label className="text-[10px] text-amber-900 font-bold">Cargas P.</label><input type="number" value={q.cargasPatronales} onChange={e => handleInputChange('cargasPatronales', e.target.value)} className="w-full p-1 border rounded text-xs" /></div>
                                        <div><label className="text-[10px] text-amber-900 font-bold">ART</label><input type="number" value={q.art} onChange={e => handleInputChange('art', e.target.value)} className="w-full p-1 border rounded text-xs" /></div>
                                        <div><label className="text-[10px] text-amber-900 font-bold">Despido</label><input type="number" value={q.previsionDespido} onChange={e => handleInputChange('previsionDespido', e.target.value)} className="w-full p-1 border rounded text-xs" /></div>
                                        <div><label className="text-[10px] text-amber-900 font-bold">Ausentismo</label><input type="number" value={q.ausentismo} onChange={e => handleInputChange('ausentismo', e.target.value)} className="w-full p-1 border rounded text-xs" /></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PASO 3: OPERATIVO */}
                        {step === 3 && (
                            <div className="card-step animate-in slide-in-from-right-4">
                                <h3 className="step-title"><Shield className="text-indigo-500"/> Costos Operativos & Valor Agregado</h3>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div><label className="label-costo">Uniforme (x Guardia/Mes)</label><input type="number" value={q.uniformeMensual} onChange={e => handleInputChange('uniformeMensual', e.target.value)} className="input-costo" /></div>
                                    <div><label className="label-costo">Equipamiento Básico (x Guardia)</label><input type="number" value={q.equipamiento} onChange={e => handleInputChange('equipamiento', e.target.value)} className="input-costo" /></div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus size={12}/> Recursos Adicionales</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end mb-4">
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-bold text-slate-400">Recurso</label>
                                            <select onChange={cargarPresetOperativo} className="w-full text-xs p-2 rounded border mb-1"><option value="">-- Catálogo --</option>{catalogoOperativo.map((i,idx) => <option key={idx} value={i.nombre}>{i.nombre}</option>)}</select>
                                            <input placeholder="Nombre..." value={newItem.nombre} onChange={e => setNewItem({...newItem, nombre: e.target.value})} className="w-full text-sm p-2 rounded border" />
                                        </div>
                                        <div className="md:col-span-3"><label className="text-[10px] font-bold text-slate-400">Costo ($)</label><input type="number" value={newItem.costo} onChange={e => setNewItem({...newItem, costo: parseFloat(e.target.value)})} className="w-full text-sm p-2 rounded border" /></div>
                                        <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400">Tipo</label><select value={newItem.tipo} onChange={e => setNewItem({...newItem, tipo: e.target.value})} className="w-full text-sm p-2 rounded border"><option value="mensual">Mensual</option><option value="fijo">Fijo (Amort.)</option></select></div>
                                        <div className="md:col-span-2 flex items-center justify-center pb-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newItem.porPuesto} onChange={e => setNewItem({...newItem, porPuesto: e.target.checked})} /><span className="text-[10px] font-bold text-slate-500">x Puesto</span></label></div>
                                        <div className="md:col-span-1"><button onClick={agregarItemOperativo} className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 flex justify-center"><Plus size={16}/></button></div>
                                    </div>
                                    <div className="space-y-2">
                                        {itemsOperativos.map(item => (
                                            <div key={item.id} className="flex justify-between items-center p-2 bg-white border rounded shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded ${item.tipo === 'fijo' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{item.tipo === 'fijo' ? <Package size={14}/> : <Car size={14}/>}</div>
                                                    <div><p className="text-xs font-bold text-slate-700">{item.nombre}</p><p className="text-[10px] text-slate-400 uppercase">{item.tipo === 'fijo' ? `Amortizado ${q.mesesContrato} meses` : 'Mensual'} {item.porPuesto && ` • x${q.puestos}`}</p></div>
                                                </div>
                                                <div className="flex items-center gap-3"><span className="text-sm font-bold text-slate-600">{formatMoney(item.costo)}</span><button onClick={() => eliminarItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PASO 4: FINANCIERO */}
                        {step === 4 && (
                            <div className="card-step animate-in slide-in-from-right-4">
                                <h3 className="step-title"><DollarSign className="text-indigo-500"/> Rentabilidad</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div><label className="label-costo">Gastos Estructura %</label><input type="number" value={q.gastosEstructura} onChange={e => handleInputChange('gastosEstructura', e.target.value)} className="input-costo" /></div>
                                        <div><label className="label-costo">Impuestos (IIBB+Tasas) %</label><input type="number" value={q.iibb} onChange={e => handleInputChange('iibb', e.target.value)} className="input-costo" /></div>
                                        <div><label className="label-costo">Impuesto Cheque %</label><input type="number" value={q.impuestoDebCred} onChange={e => handleInputChange('impuestoDebCred', e.target.value)} className="input-costo" /></div>
                                    </div>
                                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-col justify-center text-center">
                                        <label className="text-sm font-bold text-emerald-800 uppercase mb-2">Margen Deseado</label>
                                        <div className="flex items-center justify-center gap-1 mb-2">
                                            <input type="number" value={q.margenDeseado} onChange={e => handleInputChange('margenDeseado', e.target.value)} className="text-3xl font-black text-center w-24 bg-transparent outline-none text-emerald-600 border-b-2 border-emerald-300 focus:border-emerald-600" />
                                            <span className="text-xl font-bold text-emerald-400">%</span>
                                        </div>
                                        <p className="text-xs text-emerald-700">Ganancia Neta Mensual: <b>{formatMoney(kpi.precioVentaTotal * (q.margenDeseado/100))}</b></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONTROL NAVEGACIÓN */}
                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">Atrás</button>
                            {step < 4 ? <button onClick={() => setStep(s => Math.min(4, s + 1))} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">Siguiente <ArrowRight size={16}/></button> : <button onClick={guardarCotizacion} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2"><Save size={16}/> Guardar</button>}
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: DASHBOARD KPI (STICKY) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 space-y-4">
                            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                                <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Precio por Hora (Sin IVA)</p>
                                <div className="text-4xl font-black tracking-tight mb-4">{formatMoney(kpi.precioHoraVenta)}</div>
                                <div className="border-t border-slate-700 pt-3">
                                    <div className="flex justify-between mb-1"><p className="text-slate-400 text-[10px] font-bold uppercase">Costo Empresa Total</p><p className="text-sm font-bold text-red-300">{formatMoney(kpi.costoDirectoTotal)}</p></div>
                                    <div className="flex justify-between"><p className="text-slate-400 text-[10px] font-bold uppercase">Precio Venta Mensual</p><p className="text-lg font-bold text-emerald-400">{formatMoney(kpi.precioVentaTotal)}</p></div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                                <h4 className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2 mb-2"><FileText size={14}/> Estructura</h4>
                                <div className="flex justify-between text-xs text-slate-600"><span>Masa Salarial (Mix)</span><span className="font-bold">{formatMoney(kpi.costoLaboralTotal)}</span></div>
                                <div className="flex justify-between text-xs text-slate-600"><span>Operativo + Amort.</span><span className="font-bold">{formatMoney(kpi.costoOperativoTotal)}</span></div>
                                <div className="border-t pt-2 flex justify-between text-xs font-bold text-slate-800"><span>Dotación Real Necesaria</span><span>{kpi.dotacion} u.</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODAL DE CONFIGURACIÓN Y CARGA DE DATOS --- */}
            {mostrarCalculadoraSueldo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Database size={20} className="text-indigo-600"/> Gestión de Datos Maestros</h3>
                        
                        <div className="space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                <p className="text-sm text-indigo-800 font-medium mb-2">Escalas Salariales</p>
                                <p className="text-xs text-indigo-600 mb-3">
                                    Utilice esta opción para resetear los valores del sistema con las escalas vigentes de SUVICO (Enero 2026).
                                </p>
                                <div className="flex gap-2">
                                    <a href="https://www.suvico.org.ar/escalas-salariales" target="_blank" className="flex-1 text-center py-2 border border-indigo-200 rounded text-xs font-bold text-indigo-600 hover:bg-white transition-colors">Ver Web Oficial</a>
                                    <button onClick={inicializarBaseDeDatos} className="flex-1 bg-indigo-600 text-white rounded text-xs font-bold py-2 hover:bg-indigo-700 transition-colors flex justify-center gap-2 items-center"><RefreshCw size={12}/> Inicializar DB</button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setMostrarCalculadoraSueldo(false)} className="text-slate-500 font-bold text-sm hover:text-slate-700">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .card-step { @apply bg-white p-6 rounded-2xl shadow-sm border border-slate-200; }
                .step-title { @apply text-lg font-bold text-slate-700 mb-4 flex items-center gap-2; }
                .label-costo { @apply block text-xs font-bold text-slate-500 uppercase mb-1; }
                .input-costo { @apply w-full p-2 rounded-lg border border-slate-200 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all; }
            `}</style>
        </DashboardLayout>
    );
}