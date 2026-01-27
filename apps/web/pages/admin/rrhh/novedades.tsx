// Archivo: pages/admin/rrhh/novedades.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import { AbsenceManagementPage } from '@/components/admin/AbsenceManagementPage';

function NovedadesPage() {
    return (
        <DashboardLayout title="Novedades y Gestión de Ausencias">
            <AbsenceManagementPage />
        </DashboardLayout>
    );
}

// Exportación protegida (asumo roles de administración y RRHH)
export default withAuthGuard(NovedadesPage, ['admin', 'hr_manager']);



