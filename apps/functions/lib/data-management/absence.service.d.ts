import { WorkloadService } from '../scheduling/workload.service';
import { IAbsence, IAbsencePayload } from '../common/interfaces/absence.interface';
export declare class AbsenceService {
    private readonly workloadService;
    private getDb;
    private readonly absencesCollection;
    constructor(workloadService: WorkloadService);
    createAbsence(payload: IAbsencePayload): Promise<IAbsence>;
}
