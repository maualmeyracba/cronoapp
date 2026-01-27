import React, { useState } from 'react';
import { callScheduleShift } from '@/services/firebase-client.service';
import { Timestamp } from 'firebase/firestore'; 

export function ShiftAssignmentForm() {
  const [employeeId, setEmployeeId] = useState('user_id_cajero_001'); // Placeholder
  const [objectiveId, setObjectiveId] = useState('obj_id_sucursal_centro'); // Placeholder
  const [startTime, setStartTime] = useState(''); 
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const shiftData = {
        employeeId,
        objectiveId,
        startTime: Timestamp.fromDate(new Date(startTime)), 
        endTime: Timestamp.fromDate(new Date(endTime)),
      };

      const result = await callScheduleShift(shiftData);
      const data = result.data as { success: boolean, shiftId: string, message: string };
      setMessage({ text: data.message || "Turno asignado correctamente", type: 'success' });
      
    } catch (err: any) {
      const errorMessage = err.details || err.message;
      setMessage({ text: `Error: ${errorMessage}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>Inicio del Turno</label>
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Fin del Turno</label>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className={inputClass} />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>Empleado ID</label>
                <input type="text" value={employeeId} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed`} />
            </div>
            <div>
                <label className={labelClass}>Objetivo ID</label>
                <input type="text" value={objectiveId} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed`} />
            </div>
        </div>

        <button 
            type="submit" 
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition duration-200 ${loading ? 'opacity-70' : ''}`}
        >
          {loading ? 'Asignando...' : 'Asignar Turno'}
        </button>
      </form>
    </div>
  );
}



