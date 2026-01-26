import React, { useState } from 'react';
import Head from 'next/head';
import { Settings, Users, Shield, Database } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import UsersTab from '@/components/admin/config/UsersTab';
import RolesTab from '@/components/admin/config/RolesTab';
import GeneralTab from '@/components/admin/config/GeneralTab';

export default function ConfigPage() {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'USERS' | 'ROLES'>('GENERAL');

    return (
        <DashboardLayout>
            <Head><title>Configuración | CronoApp</title></Head>
            <div className="p-6 max-w-7xl mx-auto min-h-screen flex flex-col space-y-6 animate-in fade-in">
                <div className="flex items-center gap-4 border-b dark:border-slate-800 pb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
                        <Settings className="text-indigo-600 dark:text-indigo-400" size={32}/>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Configuración del Sistema</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Gestión de parámetros, usuarios de plataforma y seguridad.</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('GENERAL')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'GENERAL' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Database size={16}/> Sistema</button>
                    <button onClick={() => setActiveTab('USERS')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'USERS' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users size={16}/> Usuarios Admin</button>
                    <button onClick={() => setActiveTab('ROLES')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'ROLES' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Shield size={16}/> Roles y Permisos</button>
                </div>

                <div className="flex-1 rounded-3xl p-2">
                    <div className="bg-transparent h-full w-full p-2">
                        {activeTab === 'GENERAL' && <GeneralTab />}
                        {activeTab === 'USERS' && <UsersTab />}
                        {activeTab === 'ROLES' && <RolesTab />}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}