import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout'; // FIX: Importación por defecto
import { ClientManagement } from '@/components/admin/client-management';

function ClientsListPage() {
    return (
        <DashboardLayout title="Gestión de Clientes y Empresas">
            <ClientManagement />
        </DashboardLayout>
    );
}

export default withAuthGuard(ClientsListPage, ['admin', 'manager']);



