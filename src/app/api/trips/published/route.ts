import { NextResponse } from 'next/server'
import { getPublishedTrips } from '@/lib/firebase/trips-public'
import { handleApiError } from '@/lib/errors/handleApiError'

export async function GET() {
  try {
    const trips = await getPublishedTrips()
    return NextResponse.json({ trips }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
