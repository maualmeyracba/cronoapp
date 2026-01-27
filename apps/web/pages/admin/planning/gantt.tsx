import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { GanttPlanningView } from '@/components/admin/planning/GanttPlanningView';

function GanttPage() {
    return (
        <DashboardLayout title="Planificación de Recursos (Gantt)">
            <div className="p-4 h-full">
                <GanttPlanningView />
            </div>
        </DashboardLayout>
    );
}

// Proteger la ruta
export default withAuthGuard(GanttPage, ['admin', 'scheduler', 'manager']);



