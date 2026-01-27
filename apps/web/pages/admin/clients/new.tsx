// Archivo: pages/admin/clients/new.tsx

import React from 'react';
// Imports con alias @/
import { withAuthGuard } from '@/components/common/withAuthGuard';

// ✅ FIX: Importamos DashboardLayout por defecto (SIN LLAVES)
import DashboardLayout from '@/components/layout/DashboardLayout'; 

// Importamos el componente Wizard que creamos antes
import { ClientSetupWizard } from '@/components/admin/client-setup-wizard';

/**
 * Componente de la página de alta de nuevos clientes y servicios.
 */
function NewClientPage() {
  return (
    <DashboardLayout title="Alta de Cliente y Servicio">
      <div className="py-6">
        {/* Renderizamos el asistente aquí */}
        <ClientSetupWizard />
      </div>
    </DashboardLayout>
  );
}

// Protegemos la ruta solo para admins (usamos array para consistencia con withAuthGuard corregido)
export default withAuthGuard(NewClientPage, ['admin']);



