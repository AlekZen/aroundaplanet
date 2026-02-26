import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { userListQuerySchema, USER_LIST_PAGE_SIZE } from '@/schemas/userManagementSchema'
import type { UserProfile } from '@/types/user'

/**
 * GET /api/users — Paginated user list for SuperAdmin panel
 * Query params: page, pageSize, search, roleFilter, statusFilter, cursor
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('users:read')

    const { searchParams } = request.nextUrl
    const parsed = userListQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Parametros invalidos', retryable: false },
        { status: 400 }
      )
    }

    const { pageSize = USER_LIST_PAGE_SIZE, search, roleFilter, statusFilter, cursor } = parsed.data
    const usersRef = adminDb.collection('users')

    // Build query: Firestore supports where + orderBy + limit
    // For roleFilter: array-contains (can't combine with inequality, so no prefix search)
    // For search: fetch broader set and filter in memory (~200 users max)
    let query: FirebaseFirestore.Query = usersRef.orderBy('displayName')

    if (statusFilter) {
      query = query.where('isActive', '==', statusFilter === 'active')
    }

    if (roleFilter) {
      query = query.where('roles', 'array-contains', roleFilter)
    }

    // If search is provided, we fetch all matching and filter/paginate in memory
    // (Firestore lacks full-text search; dataset is small ~200 users max)
    if (search) {
      const allSnapshot = await query.get()
      const searchLower = search.toLowerCase()

      const allUsers: UserProfile[] = allSnapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile)
        .filter((u) =>
          u.displayName?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower)
        )

      const total = allUsers.length
      const cursorIndex = cursor ? allUsers.findIndex((u) => u.uid === cursor) : -1
      if (cursor && cursorIndex === -1) {
        return NextResponse.json(
          { code: 'INVALID_CURSOR', message: 'Cursor de paginacion invalido o expirado', retryable: false },
          { status: 400 }
        )
      }
      const startIndex = cursorIndex + 1
      const page = allUsers.slice(startIndex, startIndex + pageSize)
      const nextCursor = startIndex + pageSize < total ? page[page.length - 1]?.uid ?? null : null

      return NextResponse.json({ users: page, nextCursor, total })
    }

    // Cursor-based pagination without search
    if (cursor) {
      const cursorDoc = await usersRef.doc(cursor).get()
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc)
      }
    }

    // Fetch pageSize + 1 to detect if there's a next page
    const snapshot = await query.limit(pageSize + 1).get()
    const docs = snapshot.docs

    const hasMore = docs.length > pageSize
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs
    const users: UserProfile[] = pageDocs.map((doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile)
    const nextPageCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id ?? null : null

    // Count total (Firestore aggregation)
    let total: number
    try {
      const countQuery = statusFilter
        ? usersRef.where('isActive', '==', statusFilter === 'active')
        : usersRef
      const countResult = roleFilter
        ? await countQuery.where('roles', 'array-contains', roleFilter).count().get()
        : await countQuery.count().get()
      total = countResult.data().count
    } catch {
      // Fallback: approximate from page data
      total = hasMore ? pageSize + 1 : users.length
    }

    return NextResponse.json({ users, nextCursor: nextPageCursor, total })
  } catch (error) {
    return handleApiError(error)
  }
}
