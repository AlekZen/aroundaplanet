import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { withCacheFallback } from '@/lib/odoo/cache'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import type { OdooRecord } from '@/types/odoo'
import type { OdooSyncResult } from '@/types/user'

/**
 * POST /api/odoo/sync-agents
 *
 * Syncs all crm.teams from Odoo into Firestore `odooAgents/{teamId}` collection.
 * Each crm.team IS an agent (freelance seller) in AroundaPlanet.
 * Also fetches order counts per team via read_group.
 */
export async function POST() {
  try {
    const claims = await requirePermission('sync:odoo')

    const client = getOdooClient()

    // Step 1: Fetch all crm.teams
    const teamsResult = await withCacheFallback<OdooRecord[]>(
      'crm.team',
      'sync-agents-teams',
      () =>
        client.searchRead(
          'crm.team',
          [],
          ['name', 'active'],
          { limit: 200 }
        )
    )

    const teams = teamsResult.data

    // Step 2: Get order counts per team (tolerant to failure)
    const orderCountMap = new Map<number, number>()
    try {
      const orderCounts = await client.readGroup(
        'sale.order',
        [['state', 'in', ['sale', 'done']]],
        ['team_id'],
        { groupby: ['team_id'], lazy: true, limit: 200, timeoutMs: 15000 }
      )
      for (const group of orderCounts) {
        const teamId = Array.isArray(group.team_id)
          ? (group.team_id[0] as number)
          : null
        if (teamId) {
          orderCountMap.set(teamId, (group.team_id_count ?? group.__count ?? 0) as number)
        }
      }
    } catch {
      console.warn('[sync-agents] Could not fetch order counts, syncing without')
    }

    // Step 3: Upsert to Firestore
    const agentsRef = adminDb.collection('odooAgents')
    const now = Timestamp.now()
    let created = 0
    let updated = 0
    let errors = 0

    for (const team of teams) {
      try {
        const teamId = team.id
        const name = String(team.name ?? '')
        const isActive = Boolean(team.active)
        const orderCount = orderCountMap.get(teamId) ?? 0
        const docRef = agentsRef.doc(String(teamId))
        const existing = await docRef.get()

        if (existing.exists) {
          await docRef.update({
            name,
            isActive,
            orderCount,
            lastSyncAt: now,
            updatedAt: now,
          })
          updated++
        } else {
          await docRef.set({
            odooTeamId: teamId,
            name,
            isActive,
            orderCount,
            lastSyncAt: now,
            createdAt: now,
            updatedAt: now,
          })
          created++
        }
      } catch (err) {
        console.error(`[sync-agents] Error syncing team ${team.id}:`, err)
        errors++
      }
    }

    const syncedAt = new Date().toISOString()

    await adminDb.collection('auditLog').add({
      action: 'odoo.syncCompleted',
      targetUid: 'system',
      performedBy: claims.uid,
      timestamp: now,
      details: {
        type: 'agents',
        total: teams.length,
        created,
        updated,
        errors,
        isStale: teamsResult.isStale,
      },
    })

    const result: OdooSyncResult = {
      total: teams.length,
      created,
      updated,
      errors,
      syncedAt,
      isStale: teamsResult.isStale,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[sync-agents] Error:', error)
    return handleApiError(error)
  }
}
