import { IEmployee } from '../common/interfaces/employee.interface';
export declare class EmployeeService {
    private getDb;
    private getAuth;
    findAllEmployees(clientId?: string): Promise<IEmployee[]>;
    updateEmployee(uid: string, data: Partial<IEmployee>): Promise<void>;
    deleteEmployee(uid: string): Promise<void>;
}
