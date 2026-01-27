import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ObjectiveMatrixView } from '@/components/admin/planning/ObjectiveMatrixView';

function MatrixPage() {
    return (
        <DashboardLayout title="Cronograma General (Vista Matriz)">
            <div className="p-6">
                <ObjectiveMatrixView />
            </div>
        </DashboardLayout>
    );
}

export default withAuthGuard(MatrixPage, ['admin', 'manager', 'supervisor']);

