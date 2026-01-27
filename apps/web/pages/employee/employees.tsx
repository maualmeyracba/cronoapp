// Archivo: pages/employee/employees.tsx

import React from 'react';
import { withAuthGuard } from '@/components/common/withAuthGuard';
// ✅ FIX CRÍTICO: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 
// Importamos el componente de gestión que ya tienes en src/components
import { EmployeeManagement } from '@/components/admin/employee-management';

function EmployeesPage() {
    return (
        <DashboardLayout title="Gestión de Recursos Humanos">
            {/* Asumo que esta vista permite a los empleados ver la información general */}
            <EmployeeManagement /> 
        </DashboardLayout>
    );
}

// Exportación protegida (asumo que esta ruta solo es para roles administrativos/HR)
export default withAuthGuard(EmployeesPage, ['admin', 'manager']);



