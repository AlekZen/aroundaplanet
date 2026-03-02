import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

const ANALYTICS_COLLECTION = 'analytics'
const EVENTS_SUBCOLLECTION = 'events'

interface WriteEventParams {
  type: string
  userId?: string | null
  metadata?: Record<string, string | number | boolean>
  ip?: string | null
}

/**
 * Write an analytics event to Firestore.
 * Events are stored at /analytics/events/{eventId}.
 * Cloud Functions (Story 5.4) will aggregate these into daily/agent/traffic views.
 */
export async function writeAnalyticsEvent({ type, userId, metadata, ip }: WriteEventParams): Promise<string> {
  const channel = (metadata?.channel as string) ?? (metadata?.agentRef ? 'agent_ref' : 'direct')

  const eventData = {
    type,
    timestamp: FieldValue.serverTimestamp(),
    channel,
    agentRef: (metadata?.agentRef as string) ?? null,
    userId: userId ?? null,
    metadata: metadata ?? {},
    ip: ip ?? null,
  }

  // Firestore path: /analytics/events/events/{eventId}
  // (subcollection under /analytics/events document)
  const docRef = await adminDb
    .collection(ANALYTICS_COLLECTION)
    .doc('events')
    .collection(EVENTS_SUBCOLLECTION)
    .add(eventData)

  return docRef.id
}
