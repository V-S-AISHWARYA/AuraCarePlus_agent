import { NextResponse } from 'next/server'
import { addMedication, listMedications, markMedicationTaken } from '@/lib/medications-db'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ medications: listMedications() })
}

export async function POST(request: Request) {
  const body = await request.json() as { id?: number; name?: string; dose?: string; instructions?: string; time?: string }
  if (body.id) {
    const medication = markMedicationTaken(body.id)
    return NextResponse.json({ medication })
  }
  if (!body.name?.trim() || !body.dose?.trim() || !body.time?.trim()) {
    return NextResponse.json({ error: 'Name, dose and time are required.' }, { status: 400 })
  }
  const medication = addMedication({ name: body.name.trim(), dose: body.dose.trim(), instructions: body.instructions?.trim() || 'follow the label', time: body.time.trim() })
  return NextResponse.json({ medication }, { status: 201 })
}
