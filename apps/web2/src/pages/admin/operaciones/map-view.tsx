
import React, { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import { useOperacionesMonitor } from '@/hooks/useOperacionesMonitor';
import { POPUP_STYLES } from '@/components/operaciones/mapStyles';
import AbsenceResolutionModal from '@/components/operaciones/AbsenceResolutionModal';
import RetentionModal from '@/components/operaciones/RetentionModal';
import { X, FileCheck, Loader2 } from 'lucide-react';

// Cargamos el mapa sin SSR
const OperacionesMap = dynamic(() => import('@/components/operaciones/OperacionesMap'), { 
    loading: () => <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> Cargando Mapa Táctico...</div>, 
    ssr: false 
});

// Modal Simple para esta vista (reducido para no duplicar código complejo si no es necesario)
const CheckOutModal = ({ isOpen, onClose, onConfirm, employeeName }: any) => {
    const [novedad, setNovedad] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
                <h3 className="font-bold mb-4">Salida: {employeeName}</h3>
                <button onClick={() => { onConfirm(false); onClose(); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold mb-2">Salida Normal</button>
                <textarea className="w-full p-2 border rounded mb-2" placeholder="Novedad..." value={novedad} onChange={e=>setNovedad(e.target.value)}/>
                <button onClick={() => { onConfirm(novedad); setNovedad(''); onClose(); }} className="w-full py-2 bg-slate-100 font-bold rounded">Reportar Novedad</button>
                <button onClick={onClose} className="mt-2 text-sm text-slate-400 w-full">Cancelar</button>
            </div>
        </div>
    );
};

export default function MapViewPage() {
    const logic = useOperacionesMonitor();
    const [wizardData, setWizardData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [retentionModal, setRetentionModal] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});
    const [checkoutData, setCheckoutData] = useState<{isOpen: boolean, shift: any}>({isOpen: false, shift: null});

    const openResolution = (shift: any) => { 
        if (shift.isRetention) setRetentionModal({ isOpen: true, shift }); 
        else setWizardData({ isOpen: true, shift }); 
    };

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-900 flex flex-col">
            <Head><title>Mapa Táctico - COSP</title></Head>
            <style>{POPUP_STYLES}</style>
            <Toaster position="top-right" />
            
            {/* Barra Superior Flotante */}
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-4">
                <h1 className="font-black text-slate-800 text-sm">VISTA TÁCTICA EXTENDIDA</h1>
                <div className="h-4 w-px bg-slate-300"></div>
                <div className="flex gap-4 text-xs font-bold">
                    <span className="text-rose-600">PRIORIDAD: {logic.stats.prioridad}</span>
                    <span className="text-emerald-600">ACTIVOS: {logic.stats.activos}</span>
                </div>
            </div>

            <div className="flex-1 relative">
                <OperacionesMap 
                    center={[-31.4201, -64.1888]} 
                    objectives={logic.objectives} 
                    processedData={logic.processedData} 
                    onAction={logic.handleAction} 
                    setMapInstance={() => {}} 
                    onOpenResolution={openResolution} 
                    onOpenCheckout={(shift:any) => setCheckoutData({isOpen:true, shift})} 
                />
            </div>

            {/* Modales necesarios para operar desde el mapa */}
            <AbsenceResolutionModal isOpen={wizardData.isOpen} onClose={() => setWizardData({isOpen:false, shift: null})} absenceShift={wizardData.shift} onResolve={() => setWizardData({isOpen:false, shift:null})} />
            <RetentionModal isOpen={retentionModal.isOpen} onClose={() => setRetentionModal({isOpen:false, shift: null})} retainedShift={retentionModal.shift} onResolve={() => setRetentionModal({isOpen:false, shift:null})} />
            <CheckOutModal isOpen={checkoutData.isOpen} onClose={() => setCheckoutData({isOpen:false, shift:null})} onConfirm={(nov:string|null) => logic.handleAction('CHECKOUT', checkoutData.shift.id, nov)} employeeName={checkoutData.shift?.employeeName} />
        </div>
    );
}
