// Archivo: pages/admin/status.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import { SystemStatus } from '@/components/admin/SystemStatus';

function StatusPage() {
    return (
        <DashboardLayout title="Diagnóstico de Sistema">
            <div className="p-6">
                <SystemStatus />
            </div>
        </DashboardLayout>
    );
}

// Exportación protegida (asumo roles de administración)
export default withAuthGuard(StatusPage, ['admin']);



