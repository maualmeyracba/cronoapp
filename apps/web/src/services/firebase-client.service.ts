import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc,
    getDoc,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import { IShift } from '@/common/interfaces/shift.interface';
import { IAbsencePayload } from '@/common/interfaces/employee.interface';
import { IObjective, IServiceContract, IShiftType } from '@/common/interfaces/client.interface';

// 1. CONFIGURACIÓN Y CREDENCIALES
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

// Exportamos las instancias para usarlas en toda la app
export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');
export const db = getFirestore(app);

// Constantes de Colecciones
const SHIFTS_COLLECTION = 'turnos';
const CONTRACTS_COLLECTION = 'contratos_servicio'; 
const OBJECTIVES_COLLECTION = 'objetivos';

// ------------------------------------------------------------------
// 2. FUNCIONES INVOCABLES (CLOUD FUNCTIONS)
// ------------------------------------------------------------------

// Auth y Usuarios
// 🛑 FIX: Nos aseguramos que esta línea esté presente y exportada
export const callCreateUser = httpsCallable(functions, 'createUser');
export const callManageSystemUsers = httpsCallable(functions, 'manageSystemUsers');

// Jerarquía y Datos Maestros
export const callManageHierarchy = httpsCallable(functions, 'manageHierarchy');
export const callManageData = httpsCallable(functions, 'manageData');
export const callManageEmployees = httpsCallable(functions, 'manageEmployees');

// Operaciones (Turnos y Fichadas)
export const callScheduleShift = httpsCallable(functions, 'scheduleShift'); 
export const callManageShifts = httpsCallable(functions, 'manageShifts');   
export const callAuditShift = httpsCallable(functions, 'auditShift');       
export const callManagePatterns = httpsCallable(functions, 'managePatterns'); 

// RRHH y Sistema
export const callManageAbsences = httpsCallable(functions, 'manageAbsences');
export const callCheckSystemHealth = httpsCallable(functions, 'checkSystemHealth');


// ------------------------------------------------------------------
// 3. WRAPPERS DE SERVICIOS (Lógica de Cliente)
// ------------------------------------------------------------------

// --- GESTIÓN DE AUSENCIAS ---
export async function createAbsence(params: { action: 'CREATE_ABSENCE', payload: IAbsencePayload }): Promise<any> {
    const { payload } = params;

    if (!payload.employeeId || !payload.clientId || !payload.startDate || !payload.endDate || !payload.reason) {
        throw new Error("Faltan datos requeridos para la ausencia.");
    }
    
    if (!(payload.startDate instanceof Date) || isNaN(payload.startDate.getTime())) {
        throw new Error("Fecha de inicio inválida.");
    }
    
    // Convertimos fechas a ISO String
    const absenceData = {
        employeeId: payload.employeeId,
        employeeName: payload.employeeName,
        clientId: payload.clientId,
        type: payload.type,
        startDate: payload.startDate.toISOString(),
        endDate: payload.endDate.toISOString(),
        reason: payload.reason,
    };

    try {
        const result = await callManageAbsences({ 
            action: params.action, 
            payload: absenceData 
        });

        if (result.data && (result.data as any).success === false) {
             throw new Error((result.data as any).message || "Error en backend.");
        }
        return result.data;
    } catch (error) {
        console.error("[Service Error - createAbsence]:", error);
        throw error;
    }
}

// --- GESTIÓN DE PATRONES (AUTOMATIZACIÓN) ---
export async function createPattern(payload: any) {
    // Validamos fechas
    const safePayload = { ...payload };
    if (payload.validFrom instanceof Date) safePayload.validFrom = payload.validFrom.toISOString();
    if (payload.validTo instanceof Date) safePayload.validTo = payload.validTo.toISOString();

    return callManagePatterns({ action: 'CREATE_PATTERN', payload: safePayload });
}

export async function getPatterns(contractId: string) {
    const res = await callManagePatterns({ action: 'GET_PATTERNS', payload: { contractId } });
    return (res.data as any) || [];
}

export async function deletePattern(id: string) {
    return callManagePatterns({ action: 'DELETE_PATTERN', payload: { id } });
}

export async function generateVacancies(contractId: string, objectiveId: string, month: number, year: number) {
    return callManagePatterns({ 
        action: 'GENERATE_VACANCIES', 
        payload: { contractId, objectiveId, month, year } 
    });
}


// ------------------------------------------------------------------
// 4. LECTURA DE DATOS (FIRESTORE DIRECTO)
// ------------------------------------------------------------------

export async function getEmployeeShifts(employeeId: string): Promise<IShift[]> {
    if (!employeeId) return [];
    
    const shiftsRef = collection(db, SHIFTS_COLLECTION);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const shiftsQuery = query(
        shiftsRef, 
        where('employeeId', '==', employeeId), 
        where('startTime', '>=', todayStart)
    );
    const snapshot = await getDocs(shiftsQuery);

    return snapshot.docs.map((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        return { ...data, id: doc.id };
    }) as unknown as IShift[];
}

export async function getObjectiveShifts(objectiveId: string): Promise<IShift[]> {
    if (!objectiveId) return [];
    
    const shiftsRef = collection(db, SHIFTS_COLLECTION);
    const shiftsQuery = query(shiftsRef, where('objectiveId', '==', objectiveId)); 
    const snapshot = await getDocs(shiftsQuery);
    
    return snapshot.docs.map((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        return { ...data, id: doc.id };
    }) as unknown as IShift[];
}

export async function getActiveContract(objectiveId: string): Promise<{ id: string, totalHours: number, name: string, quantity?: number, daysOfWeek?: number[] } | null> {
    if (!objectiveId) return null;

    try {
        const contractsRef = collection(db, CONTRACTS_COLLECTION);
        const q = query(
            contractsRef, 
            where('objectiveId', '==', objectiveId),
            where('isActive', '==', true) 
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;

        const docSnapshot = snapshot.docs[0];
        const docData = docSnapshot.data();
        return {
            id: docSnapshot.id,
            totalHours: docData.totalHoursPerMonth || 0,
            name: docData.name || 'Contrato',
            quantity: docData.quantity,
            daysOfWeek: docData.daysOfWeek
        };
    } catch (e) {
        console.error("Error fetching contract:", e);
        return null;
    }
}


// ------------------------------------------------------------------
// 5. TORRE DE CONTROL (DASHBOARD OBJETIVO)
// ------------------------------------------------------------------

export async function getObjectiveControlData(objectiveId: string) {
    if (!objectiveId) throw new Error("ID de objetivo requerido");

    try {
        const objRef = doc(db, OBJECTIVES_COLLECTION, objectiveId);
        const objSnap = await getDoc(objRef);

        if (!objSnap.exists()) throw new Error("El objetivo no existe.");
        const objective = { id: objSnap.id, ...objSnap.data() } as IObjective;

        const today = new Date();
        today.setHours(0,0,0,0);

        const shiftsRef = collection(db, SHIFTS_COLLECTION);
        const q = query(
            shiftsRef,
            where('objectiveId', '==', objectiveId),
            where('startTime', '>=', today)
        );

        const shiftSnaps = await getDocs(q);
        const shifts = shiftSnaps.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as IShift[];

        shifts.sort((a, b) => {
            const timeA = (a.startTime as any).toDate ? (a.startTime as any).toDate() : new Date(a.startTime as any);
            const timeB = (b.startTime as any).toDate ? (b.startTime as any).toDate() : new Date(b.startTime as any);
            return timeA.getTime() - timeB.getTime();
        });

        return { objective, shifts };

    } catch (error) {
        console.error("Error fetching control data:", error);
        throw error;
    }
}


// ------------------------------------------------------------------
// 6. ABM DE JERARQUÍA Y TURNOS
// ------------------------------------------------------------------

export async function updateObjective(id: string, data: Partial<IObjective>) {
    return await callManageHierarchy({
        action: 'UPDATE_OBJECTIVE',
        payload: { id, data }
    });
}

export async function getObjectiveContracts(objectiveId: string): Promise<IServiceContract[]> {
    try {
        const q = query(collection(db, CONTRACTS_COLLECTION), where('objectiveId', '==', objectiveId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as IServiceContract[];
    } catch (error) {
        console.error("Error fetching contracts:", error);
        return [];
    }
}

export async function createServiceForObjective(payload: { objectiveId: string, name: string, totalHours: number, quantity?: number, daysOfWeek?: number[] }) {
    return await callManageHierarchy({
        action: 'CREATE_CONTRACT',
        payload: {
            objectiveId: payload.objectiveId,
            name: payload.name,
            totalHoursPerMonth: payload.totalHours,
            quantity: payload.quantity || 1,
            daysOfWeek: payload.daysOfWeek || [],
            startDate: new Date().toISOString(),
            isActive: true
        }
    });
}

export async function updateServiceContract(id: string, data: any) {
    return await callManageHierarchy({ action: 'UPDATE_CONTRACT', payload: { id, data } });
}

export async function deleteServiceContract(id: string) {
    return await callManageHierarchy({ action: 'DELETE_CONTRACT', payload: { id } });
}

export async function getShiftTypes(contractId: string): Promise<IShiftType[]> {
    try {
        const res = await callManageHierarchy({ action: 'GET_SHIFT_TYPES', payload: { contractId } });
        return (res.data as any).data || [];
    } catch (error) { return []; }
}

export async function createShiftType(payload: Omit<IShiftType, 'id'>) {
    return await callManageHierarchy({ action: 'CREATE_SHIFT_TYPE', payload });
}

export async function updateShiftType(id: string, data: Partial<IShiftType>) {
    return await callManageHierarchy({ action: 'UPDATE_SHIFT_TYPE', payload: { id, data } });
}

export async function deleteShiftType(id: string) {
    return await callManageHierarchy({ action: 'DELETE_SHIFT_TYPE', payload: { id } });
}

// --- CRUD TURNOS ---
export async function updateShift(id: string, data: any) {
    const payloadData = { ...data };
    if (payloadData.startTime instanceof Date) payloadData.startTime = payloadData.startTime.toISOString();
    if (payloadData.endTime instanceof Date) payloadData.endTime = payloadData.endTime.toISOString();

    return await callManageShifts({ action: 'UPDATE_SHIFT', payload: { id, data: payloadData } });
}

export async function deleteShift(id: string) {
    return await callManageShifts({ action: 'DELETE_SHIFT', payload: { id } });
}



