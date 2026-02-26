import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { withCacheFallback } from '@/lib/odoo/cache'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { DEFAULT_ROLE } from '@/config/roles'
import type { OdooSyncResult } from '@/types/user'
import type { OdooRecord } from '@/types/odoo'

const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF]/g

function stripZeroWidth(value: string): string {
  return value.replace(ZERO_WIDTH_REGEX, '')
}

function sanitizeStringField(value: unknown): string {
  if (typeof value !== 'string') return ''
  return stripZeroWidth(value).trim()
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? '', lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

interface TransformedAgent {
  odooPartnerId: number
  odooUserId: number
  odooTeamId: number | null
  odooWriteDate: string
  displayName: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

/**
 * Odoo 18: team_ids does NOT exist on res.partner.
 * Relationship: crm.team.member_ids → res.users → res.partner (via partner_id)
 *
 * Strategy:
 * 1. Fetch crm.team → collect all member_ids (res.users IDs)
 * 2. Fetch res.users for those IDs → get partner_id + login (email)
 * 3. Fetch res.partner for those partner_ids → get name, email, phone
 * 4. Merge into a single agent record with team association
 */
export async function POST() {
  try {
    const claims = await requirePermission('sync:odoo')

    const client = getOdooClient()

    // Step 1: Fetch all sales teams with their members
    const teamsResult = await withCacheFallback<OdooRecord[]>(
      'crm.team',
      'sync-all-teams',
      () =>
        client.searchRead(
          'crm.team',
          [],
          ['name', 'member_ids', 'active'],
          {}
        )
    )

    const teams = teamsResult.data

    // Build map: userId → teamId (first team wins if user is in multiple)
    const userIdToTeamId = new Map<number, number>()
    const allUserIds = new Set<number>()

    for (const team of teams) {
      const memberIds = team.member_ids
      if (Array.isArray(memberIds)) {
        for (const uid of memberIds) {
          const userId = uid as number
          allUserIds.add(userId)
          if (!userIdToTeamId.has(userId)) {
            userIdToTeamId.set(userId, team.id)
          }
        }
      }
    }

    if (allUserIds.size === 0) {
      // No team members found — nothing to sync
      const syncedAt = new Date().toISOString()
      await adminDb.collection('auditLog').add({
        action: 'odoo.syncCompleted',
        targetUid: 'system',
        performedBy: claims.uid,
        timestamp: Timestamp.now(),
        details: { total: 0, created: 0, updated: 0, errors: 0, isStale: teamsResult.isStale },
      })
      return NextResponse.json({
        total: 0, created: 0, updated: 0, errors: 0, syncedAt, isStale: teamsResult.isStale,
      } satisfies OdooSyncResult)
    }

    // Step 2: Fetch res.users for those member IDs → get partner_id
    const usersResult = await withCacheFallback<OdooRecord[]>(
      'res.users',
      'sync-team-users',
      () =>
        client.searchRead(
          'res.users',
          [['id', 'in', [...allUserIds]]],
          ['name', 'login', 'partner_id', 'active'],
          { limit: 500 }
        )
    )

    const odooUsers = usersResult.data

    // Collect partner IDs to fetch
    const partnerIds = new Set<number>()
    const userIdToOdooUser = new Map<number, OdooRecord>()

    for (const user of odooUsers) {
      userIdToOdooUser.set(user.id, user)
      const partnerId = Array.isArray(user.partner_id) ? (user.partner_id[0] as number) : null
      if (partnerId) {
        partnerIds.add(partnerId)
      }
    }

    // Step 3: Fetch res.partner for those partner IDs → full contact info
    const partnersResult = await withCacheFallback<OdooRecord[]>(
      'res.partner',
      'sync-agent-partners',
      () =>
        client.searchRead(
          'res.partner',
          [['id', 'in', [...partnerIds]]],
          ['name', 'email', 'phone', 'mobile', 'write_date'],
          { limit: 500 }
        )
    )

    const partnerMap = new Map<number, OdooRecord>()
    for (const p of partnersResult.data) {
      partnerMap.set(p.id, p)
    }

    // Step 4: Merge into agent records
    const agents: TransformedAgent[] = []
    for (const odooUser of odooUsers) {
      const partnerId = Array.isArray(odooUser.partner_id) ? (odooUser.partner_id[0] as number) : null
      const partner = partnerId ? partnerMap.get(partnerId) : null

      const rawName = sanitizeStringField(partner?.name ?? odooUser.name)
      const { firstName, lastName } = splitName(rawName)
      const email = sanitizeStringField(partner?.email ?? odooUser.login)
      const phone = sanitizeStringField(partner?.phone ?? partner?.mobile ?? '')

      agents.push({
        odooPartnerId: partnerId ?? 0,
        odooUserId: odooUser.id,
        odooTeamId: userIdToTeamId.get(odooUser.id) ?? null,
        odooWriteDate: sanitizeStringField(partner?.write_date ?? ''),
        displayName: rawName,
        firstName,
        lastName,
        email,
        phone,
      })
    }

    const isStale = teamsResult.isStale || usersResult.isStale || partnersResult.isStale

    // Step 5: Upsert to Firestore
    let created = 0
    let updated = 0
    let errors = 0

    const usersRef = adminDb.collection('users')
    const now = Timestamp.now()

    for (const agent of agents) {
      try {
        if (!agent.email) {
          errors++
          continue
        }

        const existingSnapshot = await usersRef
          .where('email', '==', agent.email)
          .limit(1)
          .get()

        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0]
          await existingDoc.ref.update({
            odooPartnerId: agent.odooPartnerId,
            odooUserId: agent.odooUserId,
            odooTeamId: agent.odooTeamId,
            odooWriteDate: agent.odooWriteDate,
            lastSyncAt: now,
            displayName: agent.displayName,
            updatedAt: now,
          })
          updated++
        } else {
          const newUserRef = usersRef.doc()
          await newUserRef.set({
            uid: newUserRef.id,
            email: agent.email,
            displayName: agent.displayName,
            firstName: agent.firstName,
            lastName: agent.lastName,
            phone: agent.phone,
            photoURL: null,
            roles: [DEFAULT_ROLE],
            isActive: false,
            needsRegistration: true,
            odooPartnerId: agent.odooPartnerId,
            odooUserId: agent.odooUserId,
            odooTeamId: agent.odooTeamId,
            odooWriteDate: agent.odooWriteDate,
            lastSyncAt: now,
            createdAt: now,
            updatedAt: now,
          })
          created++
        }
      } catch (err) {
        console.error(`[sync-users] Error procesando agent ${agent.email}:`, err)
        errors++
      }
    }

    const syncedAt = new Date().toISOString()

    await adminDb.collection('auditLog').add({
      action: 'odoo.syncCompleted',
      targetUid: 'system',
      performedBy: claims.uid,
      timestamp: now,
      details: { total: agents.length, created, updated, errors, isStale },
    })

    const result: OdooSyncResult = {
      total: agents.length,
      created,
      updated,
      errors,
      syncedAt,
      isStale,
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
