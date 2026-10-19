import Database from 'better-sqlite3'
import path from 'node:path'

const db = new Database(path.join(process.cwd(), 'auracare.sqlite'))
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS medications (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dose TEXT NOT NULL, instructions TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', taken_at TEXT); CREATE TABLE IF NOT EXISTS action_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)`)
const seed = db.prepare('SELECT COUNT(*) as count FROM medications').get() as { count: number }
if (seed.count === 0) {
  const insert = db.prepare('INSERT INTO medications (name, dose, instructions, time, status) VALUES (?, ?, ?, ?, ?)')
  insert.run('Metoprolol', '25 mg', 'with breakfast', '8:00 AM', 'taken')
  insert.run('Vitamin D3', '1000 IU', 'with water', '12:00 PM', 'due')
  insert.run('Amlodipine', '5 mg', 'after dinner', '7:00 PM', 'scheduled')
}
export function listMedications() { return db.prepare('SELECT * FROM medications ORDER BY id').all() }
export function addMedication(input: { name: string; dose: string; instructions: string; time: string }) {
  const result = db.prepare('INSERT INTO medications (name, dose, instructions, time, status) VALUES (?, ?, ?, ?, ?)').run(input.name, input.dose, input.instructions, input.time, 'scheduled')
  return db.prepare('SELECT * FROM medications WHERE id=?').get(result.lastInsertRowid)
}
export function markMedicationTaken(id: number) { db.prepare("UPDATE medications SET status='taken', taken_at=? WHERE id=?").run(new Date().toISOString(), id); return db.prepare('SELECT * FROM medications WHERE id=?').get(id) }
