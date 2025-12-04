import { Injectable, InternalServerErrorException, ConflictException } from '@nestjs/common';
import * as admin from 'firebase-admin';
// Usamos ruta relativa para evitar problemas de alias en el build
import { IEmployee } from '../common/interfaces/employee.interface';

const EMPLOYEES_COLLECTION = 'empleados';

@Injectable()
export class AuthService {

  // 🔑 Inicialización diferida (Lazy Loading) para evitar error 'app/no-app'
  private getAuth = () => admin.app().auth();
  private getDb = () => admin.app().firestore();

  async createEmployeeProfile(
    email: string,
    password: string,
    role: IEmployee['role'],
    name: string,
  ): Promise<IEmployee> {
    
    const authInstance = this.getAuth(); 
    
    // 1. Crear usuario en Auth
    const user = await authInstance.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    }).catch(error => {
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException('The email address is already in use.');
      }
      console.error('[AUTH_CREATE_ERROR]', error.message);
      throw new InternalServerErrorException('Failed to create user in Firebase Auth.');
    });

    const employeeUid = user.uid;

    // 2. Asignar Custom Claims (Rol)
    try {
      await authInstance.setCustomUserClaims(employeeUid, { role });
    } catch (error) {
      console.error(`[CLAIMS_ERROR] Failed to set claims.`, error);
      await authInstance.deleteUser(employeeUid); 
      throw new InternalServerErrorException('Failed to assign role. Account creation aborted.');
    }
    
    // 3. Crear Perfil en Firestore
    // 🛑 FIX TS2739: Agregamos los nuevos campos obligatorios con valores por defecto
    const employeeProfile: IEmployee = {
      uid: employeeUid,
      email: email,
      name: name,
      role: role,
      isAvailable: true,
      maxHoursPerMonth: 176,        // Valor estándar (Convenio)
      contractType: 'FullTime'      // Valor estándar
    };
    
    const dbInstance = this.getDb();
    
    try {
      await dbInstance.collection(EMPLOYEES_COLLECTION).doc(employeeUid).set(employeeProfile);
    } catch (error) {
      console.error(`[FIRESTORE_ERROR] Failed to create profile.`, error);
      await authInstance.deleteUser(employeeUid);
      throw new InternalServerErrorException('Failed to save profile. Account creation aborted.');
    }

    return employeeProfile;
  }
}