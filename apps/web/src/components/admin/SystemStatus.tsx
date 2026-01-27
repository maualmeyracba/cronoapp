import React, { useState, useEffect } from 'react';
import { callManageHierarchy, callManageEmployees, callCheckSystemHealth, auth } from '@/services/firebase-client.service';

interface HealthMetric {
    name: string;
    status: 'pending' | 'ok' | 'warning' | 'error';
    value?: string;
    details?: string;
}

export function SystemStatus() {
    const [metrics, setMetrics] = useState<HealthMetric[]>([
        { name: 'Conectividad Internet', status: 'pending' },
        { name: 'Sesión de Usuario (Auth)', status: 'pending' },
        { name: 'Servidor (Cloud Functions)', status: 'pending' },
        { name: 'Base de Datos (Firestore)', status: 'pending' },
        { name: 'Módulo Jerarquía', status: 'pending' },
        { name: 'Módulo RRHH', status: 'pending' },
    ]);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => { runDiagnostics(); }, []);

    const updateMetric = (index: number, status: HealthMetric['status'], value: string, details: string = '') => {
        setMetrics(prev => {
            const newM = [...prev];
            newM[index] = { ...newM[index], status, value, details };
            return newM;
        });
    };

    const runDiagnostics = async () => {
        setIsRunning(true);
        
        // 1. Local Checks
        const isOnline = navigator.onLine;
        updateMetric(0, isOnline ? 'ok' : 'error', isOnline ? 'Online' : 'Offline');
        if (!isOnline) { setIsRunning(false); return; }

        const user = auth.currentUser;
        updateMetric(1, user ? 'ok' : 'error', user ? 'Autenticado' : 'Sin Sesión', user?.uid);

        // 2. Health Check Real (Ping al servidor)
        const startServer = Date.now();
        try {
            const healthRes = await callCheckSystemHealth({});
            const endServer = Date.now();
            const data = healthRes.data as any;

            updateMetric(2, 'ok', `${endServer - startServer}ms`, `Node ${data.nodeVersion}`);
            
            const dbLat = data.database.latencyMs;
            updateMetric(3, data.database.status === 'connected' ? 'ok' : 'error', `${dbLat}ms`);

        } catch (error: any) {
            updateMetric(2, 'error', 'Fallo Crítico', error.message);
            updateMetric(3, 'error', 'Inaccesible', 'Timeout o Error 500');
        }

        // 3. Smoke Test de Módulos
        await testModule(4, async () => callManageHierarchy({ action: 'GET_ALL_CLIENTS', payload: {} }));
        await testModule(5, async () => callManageEmployees({ action: 'GET_ALL_EMPLOYEES', payload: {} }));

        setIsRunning(false);
    };

    const testModule = async (index: number, call: () => Promise<any>) => {
        const start = Date.now();
        try {
            await call();
            updateMetric(index, 'ok', `${Date.now() - start}ms`, 'Operativo');
        } catch (error: any) {
            updateMetric(index, 'error', 'Fallo', error.message);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Monitor de Salud</h3>
                <button onClick={runDiagnostics} disabled={isRunning} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 disabled:opacity-50">
                    {isRunning ? 'Escaneando...' : 'Re-escanear'}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((m, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border flex items-center justify-between ${m.status === 'ok' ? 'bg-green-50 border-green-100' : m.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-gray-50'}`}>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">{m.name}</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${m.status === 'ok' ? 'bg-green-500' : m.status === 'error' ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
                                <span className="font-bold text-slate-700">{m.status === 'pending' ? '...' : m.value}</span>
                            </div>
                        </div>
                        {m.details && <div className="text-xs text-gray-500 text-right max-w-[120px] truncate" title={m.details}>{m.details}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
}



