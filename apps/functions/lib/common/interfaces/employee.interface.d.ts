export type EmployeeRole = 'admin' | 'employee';
export type ContractType = 'FullTime' | 'PartTime' | 'Eventual';
export interface IEmployee {
    uid: string;
    name: string;
    role: EmployeeRole;
    email: string;
    isAvailable: boolean;
    maxHoursPerMonth: number;
    contractType: ContractType;
}
