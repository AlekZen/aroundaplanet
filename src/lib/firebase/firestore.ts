import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { firebaseApp } from './client'
import type { UserProfile } from '@/types/user'
import { userProfileSchema } from '@/schemas/userProfileSchema'

export const db = getFirestore(firebaseApp)

export async function createUserProfile(
  user: User,
  provider: 'email' | 'google'
): Promise<void> {
  const userRef = doc(db, 'users', user.uid)
  const existing = await getDoc(userRef)

  if (existing.exists()) {
    await setDoc(
      userRef,
      { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    )
    return
  }

  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || null,
    roles: ['cliente'],
    isActive: true,
    provider,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  })
}

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) return null
  const parsed = userProfileSchema.safeParse(snapshot.data())
  if (!parsed.success) {
    console.error('Invalid user profile data:', parsed.error.flatten())
    return null
  }
  return parsed.data as UserProfile
}

export async function updateLastLogin(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid)
  await setDoc(
    userRef,
    { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  )
}
