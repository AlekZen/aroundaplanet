import { FirebaseError } from 'firebase/app'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'No existe una cuenta con este correo electronico',
  'auth/wrong-password': 'Contraseña incorrecta',
  'auth/invalid-credential': 'Correo o contraseña incorrectos',
  'auth/too-many-requests': 'Demasiados intentos. Intenta mas tarde',
  'auth/user-disabled': 'Esta cuenta ha sido desactivada',
  'auth/email-already-in-use': 'Ya existe una cuenta con este correo electronico',
  'auth/weak-password': 'La contraseña es demasiado debil',
  'auth/operation-not-allowed': 'El registro con email no esta habilitado',
  'auth/popup-blocked':
    'Tu navegador bloqueo la ventana de Google. Intenta de nuevo o usa email y contraseña.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con este correo. Intenta con otro metodo de inicio de sesion.',
}

export function getFirebaseErrorMessage(
  error: unknown,
  fallback = 'Error inesperado. Intenta de nuevo.'
): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] ?? fallback
  }
  return fallback
}
