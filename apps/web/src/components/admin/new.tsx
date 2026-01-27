// Archivo: ./src/components/admin/new.tsx (o la página asociada)

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import { ClientSetupWizard } from '@/components/admin/client-setup-wizard';

function NewClientPage() {
    return (
        <DashboardLayout title="Alta de Cliente y Servicio">
            <div className="py-6">
                <ClientSetupWizard />
            </div>
        </DashboardLayout>
    );
}

// Exportación protegida (asumo roles de administración)
export default withAuthGuard(NewClientPage, ['admin']);



