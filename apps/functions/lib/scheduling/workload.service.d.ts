import { IShift } from '../common/interfaces/shift.interface';
export declare class WorkloadService {
    private getDb;
    validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date): Promise<void>;
    checkShiftOverlap(employeeId: string, start: Date, end: Date): Promise<IShift[]>;
    private checkAvailability;
    private checkMonthlyLimit;
}
