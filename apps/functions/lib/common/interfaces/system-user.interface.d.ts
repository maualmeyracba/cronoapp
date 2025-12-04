import * as admin from 'firebase-admin';
export type SystemRole = 'SuperAdmin' | 'Scheduler' | 'HR_Manager' | 'Viewer';
export interface ISystemUser {
    uid: string;
    email: string;
    displayName: string;
    role: SystemRole;
    status: 'Active' | 'Inactive';
    createdAt: admin.firestore.Timestamp;
    lastLogin?: admin.firestore.Timestamp;
}
