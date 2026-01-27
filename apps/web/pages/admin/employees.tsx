// Archivo: pages/admin/employees.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
import { EmployeeManagement } from '@/components/admin/employee-management';

function EmployeesPage() {
    return (
        <DashboardLayout title="Gestión de Personal">
            <EmployeeManagement />
        </DashboardLayout>
    );
}

// Exportación protegida (asumo roles de administración y RRHH)
export default withAuthGuard(EmployeesPage, ['admin', 'hr_manager']);



