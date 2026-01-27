import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AbsenceManagementPage } from '@/components/admin/AbsenceManagementPage';

export default function GestióndeAusenciasPage() {
  return (
    <DashboardLayout title="Gestión de Ausencias y Licencias">
      <AbsenceManagementPage />
    </DashboardLayout>
  );
}