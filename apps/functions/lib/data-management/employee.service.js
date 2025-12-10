"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const workload_service_1 = require("../scheduling/workload.service");
const COLL_EMPLOYEES = 'empleados';
let EmployeeService = class EmployeeService {
    constructor(workloadService) {
        this.workloadService = workloadService;
        this.getDb = () => admin.app().firestore();
        this.getAuth = () => admin.app().auth();
    }
    async findAllEmployees(clientId) {
        try {
            let query = this.getDb().collection(COLL_EMPLOYEES);
            if (clientId) {
                query = query.where('clientId', '==', clientId);
            }
            const snapshot = await query.get();
            return snapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            console.error('[GET_EMPLOYEES_ERROR]', error);
            throw new common_1.InternalServerErrorException('Error al obtener la lista de empleados.');
        }
    }
    async getEmployeeWorkload(uid, month, year) {
        const report = await this.workloadService.getWorkloadReport(uid, month, year);
        return report;
    }
    async updateEmployee(uid, data) {
        const db = this.getDb();
        const auth = this.getAuth();
        const ref = db.collection(COLL_EMPLOYEES).doc(uid);
        const doc = await ref.get();
        if (!doc.exists) {
            throw new common_1.NotFoundException('Empleado no encontrado.');
        }
        const updateData = { ...data };
        if (updateData.payrollCycleStartDay !== undefined)
            updateData.payrollCycleStartDay = Number(updateData.payrollCycleStartDay);
        if (updateData.payrollCycleEndDay !== undefined)
            updateData.payrollCycleEndDay = Number(updateData.payrollCycleEndDay);
        delete updateData.uid;
        delete updateData.email;
        await ref.update(updateData);
        if (data.role) {
            try {
                await auth.setCustomUserClaims(uid, { role: data.role });
            }
            catch (e) {
                console.error(`Error actualizando claims para ${uid}`, e);
            }
        }
    }
    async deleteEmployee(uid) {
        try {
            await this.getAuth().deleteUser(uid);
            await this.getDb().collection(COLL_EMPLOYEES).doc(uid).delete();
        }
        catch (error) {
            console.error('[DELETE_EMPLOYEE_ERROR]', error);
            throw new common_1.InternalServerErrorException('Error al eliminar el empleado.');
        }
    }
};
exports.EmployeeService = EmployeeService;
exports.EmployeeService = EmployeeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workload_service_1.WorkloadService])
], EmployeeService);
//# sourceMappingURL=employee.service.js.map