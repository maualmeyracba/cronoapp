import * as admin from 'firebase-admin';
import { IShift } from '../common/interfaces/shift.interface';
import { ShiftOverlapService } from './shift-overlap.service';
import { WorkloadService } from './workload.service';
export declare class SchedulingService {
    private readonly overlapService;
    private readonly workloadService;
    private getDb;
    constructor(overlapService: ShiftOverlapService, workloadService: WorkloadService);
    private convertToDate;
    assignShift(shiftData: Partial<IShift>, userAuth: admin.auth.DecodedIdToken): Promise<IShift>;
}
