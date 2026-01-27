import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { LaborAgreementsManager } from '@/components/admin/labor-agreements-manager';

function LaborAgreementsPage() {
    return (
        <DashboardLayout title="Gestión de Convenios Colectivos">
            <div className="p-6">
                <LaborAgreementsManager />
            </div>
        </DashboardLayout>
    );
}

export default withAuthGuard(LaborAgreementsPage, ['admin', 'hr_manager']);



