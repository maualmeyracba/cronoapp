import { IShift } from '../common/interfaces/shift.interface';
export declare class WorkloadService {
    private getDb;
    private toDate;
    private getCycleDates;
    validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date, excludeShiftId?: string): Promise<void>;
    checkShiftOverlap(employeeId: string, start: Date, end: Date, excludeShiftId?: string): Promise<IShift[]>;
    private checkAvailability;
    private checkMonthlyLimit;
    getWorkloadReport(employeeId: string, month: number, year: number): Promise<any>;
}
