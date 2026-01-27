// Archivo: pages/admin/system-users.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import { SystemUserManagement } from '@/components/admin/system-user-management';

function SystemUsersPage() {
    return (
        <DashboardLayout title="Gestión de Usuarios del Sistema">
            <SystemUserManagement />
        </DashboardLayout>
    );
}

// Exportación protegida (asumo roles de administración)
export default withAuthGuard(SystemUsersPage, ['admin']);



