import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { getOdooClient } from '@/lib/odoo/client'
import { withCacheFallback } from '@/lib/odoo/cache'
import { adminDb } from '@/lib/firebase/admin'
import type { OdooRecord } from '@/types/odoo'

export interface OdooAgentResponse {
  /** crm.team ID — this is the agent identifier in Odoo */
  odooTeamId: number
  name: string
  isActive: boolean
  /** Number of confirmed sale.orders for this agent */
  orderCount: number
  /** UID of linked platform user (if exists in Firestore users with matching odooTeamId) */
  linkedUserId: string | null
  linkedUserDisplayName: string | null
}

/**
 * GET /api/odoo/agents
 *
 * In AroundaPlanet's Odoo, each crm.team IS an agent (freelance seller).
 * They have names like "NOEL SAHAGUN CERVANTES", "RUBISELA MATA TREJO", etc.
 * The generic teams "Sales" and "REDES" are shared functional accounts.
 *
 * Strategy:
 * 1. Fetch all crm.teams (the agents)
 * 2. read_group on sale.order by team_id to get order counts (separate call, tolerant to failure)
 * 3. Cross-reference with Firestore users (by odooTeamId) for platform links
 */
export async function GET() {
  try {
    await requirePermission('users:read')

    const client = getOdooClient()

    // Step 1: Fetch all crm.teams
    const teamsResult = await withCacheFallback<OdooRecord[]>(
      'crm.team',
      'agents-all-teams',
      () =>
        client.searchRead(
          'crm.team',
          [],
          ['name', 'active'],
          { limit: 200 }
        )
    )

    // Step 2: Get order counts per team via read_group (non-blocking — if it fails, we still show teams)
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
    } catch (err) {
      console.warn('[odoo/agents] Could not fetch order counts, continuing without:', err)
    }

    // Step 3: Build agent list from teams
    const agents: OdooAgentResponse[] = []
    const teamIds: number[] = []

    for (const team of teamsResult.data) {
      const name = String(team.name ?? '')
      const teamId = team.id
      const orderCount = orderCountMap.get(teamId) ?? 0

      teamIds.push(teamId)

      agents.push({
        odooTeamId: teamId,
        name,
        isActive: Boolean(team.active),
        orderCount,
        linkedUserId: null,
        linkedUserDisplayName: null,
      })
    }

    // Step 4: Check which agents have platform users (by odooTeamId match)
    if (teamIds.length > 0) {
      const BATCH_SIZE = 30
      for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
        const batch = teamIds.slice(i, i + BATCH_SIZE)
        const usersSnap = await adminDb
          .collection('users')
          .where('odooTeamId', 'in', batch)
          .select('odooTeamId', 'displayName', 'uid')
          .get()

        const teamIdToUser = new Map<number, { uid: string; displayName: string }>()
        for (const doc of usersSnap.docs) {
          const data = doc.data()
          const tid = data.odooTeamId as number
          if (tid) {
            teamIdToUser.set(tid, {
              uid: String(data.uid ?? doc.id),
              displayName: String(data.displayName ?? ''),
            })
          }
        }

        for (const agent of agents) {
          if (!agent.linkedUserId) {
            const match = teamIdToUser.get(agent.odooTeamId)
            if (match) {
              agent.linkedUserId = match.uid
              agent.linkedUserDisplayName = match.displayName
            }
          }
        }
      }
    }

    // Sort: by order count desc (most active first), then alphabetical
    agents.sort((a, b) => {
      if (a.orderCount !== b.orderCount) return b.orderCount - a.orderCount
      return a.name.localeCompare(b.name, 'es')
    })

    return NextResponse.json(agents)
  } catch (error) {
    console.error('[odoo/agents] Error:', error)
    return handleApiError(error)
  }
}
