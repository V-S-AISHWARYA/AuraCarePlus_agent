import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'node:path'

const db = new Database(path.join(process.cwd(), 'auracare.sqlite'))
db.exec('CREATE TABLE IF NOT EXISTS action_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)')

export async function POST(request: Request) {
  const body = await request.json() as { type?: string; detail?: string }
  if (!body.type || !body.detail) return NextResponse.json({ error: 'Alert details are required.' }, { status: 400 })
  db.prepare('INSERT INTO action_memory (type, detail, created_at) VALUES (?, ?, ?)').run(body.type.slice(0, 80), body.detail.slice(0, 500), new Date().toISOString())
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const actions = db.prepare('SELECT * FROM action_memory ORDER BY id DESC LIMIT 30').all()
  return NextResponse.json({ actions })
}
