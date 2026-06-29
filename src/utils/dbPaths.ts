import { collection, doc, CollectionReference, DocumentReference, Firestore } from 'firebase/firestore';
import { db, getAppId } from '../config/firebase';

/**
 * กฎเหล็กข้อที่ 1 (Strict Paths)
 * ข้อมูลสาธารณะ: /artifacts/{appId}/public/data/{collectionName}
 */
export const getPublicCollection = (
    collectionName: string
): CollectionReference => {
    const appId = getAppId();
    return collection(db, 'artifacts', appId, collectionName);
};

export const getPublicDoc = (
    collectionName: string,
    docId: string
): DocumentReference => {
    const appId = getAppId();
    return doc(db, 'artifacts', appId, collectionName, docId);
};

/**
 * กฎเหล็กข้อที่ 1 (Strict Paths)
 * ข้อมูลส่วนตัวของผู้ใช้ครู: /artifacts/{appId}/users/{userId}/{collectionName}
 */
export const getPrivateCollection = (
    userId: string,
    collectionName: string
): CollectionReference => {
    const appId = getAppId();
    return collection(db, 'artifacts', appId, 'users', userId, collectionName);
};

export const getPrivateDoc = (
    userId: string,
    collectionName: string,
    docId: string
): DocumentReference => {
    const appId = getAppId();
    return doc(db, 'artifacts', appId, 'users', userId, collectionName, docId);
};