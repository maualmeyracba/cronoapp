import { IEmployee } from '../common/interfaces/employee.interface';
import { IShift } from '../common/interfaces/shift.interface';
import { LaborAgreementService } from '../data-management/labor-agreement.service';
export declare class WorkloadService {
    private readonly agreementService;
    private getDb;
    constructor(agreementService: LaborAgreementService);
    private toDate;
    private getCycleDates;
    validateAssignment(employeeId: string, shiftStart: Date, shiftEnd: Date, excludeShiftId?: string): Promise<any>;
    private checkWeeklyLimit;
    calculateShiftBreakdown(employee: IEmployee, weekStart: Date, start: Date, end: Date, rules: any): Promise<{
        totalDuration: number;
        breakdown: {
            normal: number;
            fifty: number;
            hundred: number;
            night: number;
        };
        agreementUsed: any;
    }>;
    checkShiftOverlap(employeeId: string, start: Date, end: Date, excludeShiftId?: string): Promise<IShift[]>;
    private checkAvailability;
    private checkMonthlyLimit;
    getWorkloadReport(employeeId: string, month: number, year: number): Promise<any>;
}
