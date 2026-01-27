// Archivo: pages/admin/objective-management.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import ObjectiveManagement from '@/components/admin/objective-management'; // Asumo exportación por defecto

function ObjectiveManagementPage() {
    return (
        <DashboardLayout title="Gestión de Objetivos y Sucursales">
            <ObjectiveManagement />
        </DashboardLayout>
    );
}

// Exportación protegida
export default withAuthGuard(ObjectiveManagementPage, ['admin']);



