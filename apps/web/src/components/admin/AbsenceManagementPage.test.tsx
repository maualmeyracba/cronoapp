// 🛑 FIX 1: Importar jest-dom para habilitar los matchers del DOM
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AbsenceManagementPage } from './AbsenceManagementPage'; 
import { useClient } from '@/context/ClientContext';
import { callCreateAbsence, callManageEmployees } from '@/services/firebase-client.service'; 
import toast from 'react-hot-toast';

// Mocks de UI
jest.mock('../common/InputField', () => ({
    __esModule: true,
    default: ({ label, onChange, value, type }: any) => (
        <input aria-label={label} type={type || 'text'} value={value} onChange={onChange} />
    ),
}));

jest.mock('../common/SelectField', () => ({
    __esModule: true,
    default: ({ label, onChange, value, children }: any) => (
        <select aria-label={label} value={value} onChange={onChange}>{children}</select>
    ),
}));

jest.mock('../common/Button', () => ({
    __esModule: true,
    default: ({ children, disabled, type, onClick }: any) => (
        <button disabled={disabled} type={type} onClick={onClick} data-testid="submit-button">{children}</button>
    ),
}));

// Mocks de servicios
jest.mock('@/context/ClientContext', () => ({ useClient: jest.fn(), }));
jest.mock('@/services/firebase-client.service', () => ({
    callManageEmployees: jest.fn(),
    callCreateAbsence: jest.fn(), 
}));
jest.mock('react-hot-toast', () => ({
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn().mockReturnValue('toast-id-mock'),
}));

const mockEmployees = [
    { uid: 'emp1', name: 'Juan Pérez', role: 'Vigilador' },
];

const mockUseClient = (selectedClientId: string | null) => (
    (useClient as jest.Mock).mockReturnValue({ selectedClientId })
);

describe('AbsenceManagementPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // 🛑 FIX 2: Doble casting para silenciar a TypeScript
        (callManageEmployees as unknown as jest.Mock).mockResolvedValue({
            data: { data: mockEmployees },
        });
        (callCreateAbsence as unknown as jest.Mock).mockResolvedValue({
            data: { success: true },
        });
        
        mockUseClient('client_abc'); 
    });

    it('should render and fetch employees successfully', async () => {
        render(<AbsenceManagementPage />);
        await waitFor(() => {
            expect(callManageEmployees).toHaveBeenCalled();
        });
        // FIX 3: Usamos el matcher que ahora sí está importado
        expect(screen.getByLabelText(/Colaborador/i)).toBeInTheDocument();
    });

    it('should validate form dates', async () => {
        render(<AbsenceManagementPage />);
        await waitFor(() => { expect(callManageEmployees).toHaveBeenCalled(); });

        fireEvent.change(screen.getByLabelText(/Colaborador/i), { target: { value: 'emp1' } });
        fireEvent.change(screen.getByLabelText(/Razón \/ Comentarios/i), { target: { value: 'Test Reason' } });
        fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2025-01-10' } });
        fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2025-01-01' } });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
        expect(callCreateAbsence).not.toHaveBeenCalled();
    });

    it('should submit successfully', async () => {
        render(<AbsenceManagementPage />);
        await waitFor(() => { expect(callManageEmployees).toHaveBeenCalled(); });

        fireEvent.change(screen.getByLabelText(/Colaborador/i), { target: { value: 'emp1' } });
        fireEvent.change(screen.getByLabelText(/Tipo de Novedad/i), { target: { value: 'SICK_LEAVE' } });
        fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2025-01-01' } });
        fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2025-01-05' } });
        fireEvent.change(screen.getByLabelText(/Razón \/ Comentarios/i), { target: { value: 'Test Sick Leave' } });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(callCreateAbsence).toHaveBeenCalled();
        });
        expect(toast.success).toHaveBeenCalled();
    });
});



