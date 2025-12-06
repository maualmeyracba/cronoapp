import { IServicePattern, IPatternPayload } from '../common/interfaces/service-pattern.interface';
export declare class PatternService {
    private getDb;
    createPattern(payload: IPatternPayload, userId: string): Promise<IServicePattern>;
    getPatternsByContract(contractId: string): Promise<IServicePattern[]>;
    generateVacancies(contractId: string, month: number, year: number): Promise<{
        created: number;
        message: string;
    }>;
}
