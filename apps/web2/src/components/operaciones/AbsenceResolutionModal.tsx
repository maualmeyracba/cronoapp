
import React from 'react';
import { X, Bell, UserPlus, AlertTriangle } from 'lucide-react';

interface AbsenceResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    absenceShift: any;
    onNotify: (shift: any) => void;
    onCover: (shift: any) => void;
}

export default function AbsenceResolutionModal({ isOpen, onClose, absenceShift, onNotify, onCover }: AbsenceResolutionModalProps) {
    if (!isOpen || !absenceShift) return null;

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="bg-rose-50 border-b border-rose-100 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-rose-700 font-bold uppercase tracking-wider text-sm">
                        <AlertTriangle size={18} />
                        PUESTO SIN ASIGNAR
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-rose-100 rounded-full text-rose-400 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h3 className="text-rose-600 font-black text-xs uppercase mb-2">¡ALERTA DE PLANIFICACIÓN!</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">Este puesto figura vacante en el sistema.</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg mt-1">{absenceShift.positionName || 'Puesto General'} en {absenceShift.clientName}</p>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => onNotify(absenceShift)} className="w-full group relative flex items-center p-4 border-2 border-rose-100 rounded-xl hover:border-rose-500 hover:bg-rose-50 transition-all duration-200">
                            <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors"><Bell size={20} /></div>
                            <div className="ml-4 text-left">
                                <h4 className="text-slate-900 font-bold text-sm group-hover:text-rose-700">Notificar a Planificación</h4>
                                <p className="text-slate-500 text-xs">Enviar alerta y cerrar incidencia por ahora.</p>
                            </div>
                        </button>
                        <button onClick={() => onCover(absenceShift)} className="w-full group relative flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200">
                            <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><UserPlus size={20} /></div>
                            <div className="ml-4 text-left">
                                <h4 className="text-slate-900 font-bold text-sm group-hover:text-indigo-700">Cubrir Operativamente</h4>
                                <p className="text-slate-500 text-xs">Buscar relevo o guardia presente.</p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
