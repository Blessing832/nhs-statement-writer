import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Use Railway volume at /data if mounted, otherwise fall back to /tmp for dev
function getDbPath(): string {
  const dir = fs.existsSync('/data') ? '/data' : '/tmp'
  return path.join(dir, 'vacancies.db')
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(getDbPath())
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS vacancies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      reference   TEXT    UNIQUE NOT NULL,
      title       TEXT    NOT NULL,
      companyName TEXT,
      location    TEXT,
      salary      TEXT,
      closingDate TEXT,
      url         TEXT    NOT NULL,
      staffGroup  TEXT    NOT NULL,
      datePosted  TEXT,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return _db
}

export interface Vacancy {
  id: number
  reference: string
  title: string
  companyName: string
  location: string
  salary: string
  closingDate: string
  url: string
  staffGroup: 'nursing' | 'allied'
  datePosted: string
  createdAt: string
}

export function insertVacancy(v: Omit<Vacancy, 'id' | 'createdAt'>): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO vacancies
       (reference, title, companyName, location, salary, closingDate, url, staffGroup, datePosted)
       VALUES (@reference, @title, @companyName, @location, @salary, @closingDate, @url, @staffGroup, @datePosted)`
    )
    .run(v)
}

export function getVacanciesByGroup(staffGroup: 'nursing' | 'allied', limit = 50): Vacancy[] {
  return getDb()
    .prepare('SELECT * FROM vacancies WHERE staffGroup = ? ORDER BY createdAt DESC LIMIT ?')
    .all(staffGroup, limit) as Vacancy[]
}

export function getAllVacancies(limit = 100): Vacancy[] {
  return getDb()
    .prepare('SELECT * FROM vacancies ORDER BY createdAt DESC LIMIT ?')
    .all(limit) as Vacancy[]
}

export function resetVacancies(): void {
  getDb().prepare('DELETE FROM vacancies').run()
}

export function countVacancies(): { nursing: number; allied: number } {
  const db = getDb()
  const nursing = (db.prepare("SELECT COUNT(*) as n FROM vacancies WHERE staffGroup='nursing'").get() as { n: number }).n
  const allied  = (db.prepare("SELECT COUNT(*) as n FROM vacancies WHERE staffGroup='allied'").get() as { n: number }).n
  return { nursing, allied }
}
