import { NextResponse } from 'next/server'
import { listMedications, markMedicationTaken } from '@/lib/medications-db'

export const runtime = 'nodejs'
export async function GET() { return NextResponse.json({ medications: listMedications() }) }
export async function POST(request: Request) {
  const body = await request.json() as { id?: number }
  if (!body.id || !Number.isInteger(body.id)) return NextResponse.json({ error: 'A medication id is required.' }, { status: 400 })
  const medication = markMedicationTaken(body.id)
  return NextResponse.json({ medication })
}
