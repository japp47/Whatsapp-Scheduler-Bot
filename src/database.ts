import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Contact, ContactsData } from './types';

const DB_PATH = path.resolve('./data/bot.db');

export class DatabaseManager {
    private db: Database.Database;

    constructor() {
        this.db = new Database(DB_PATH);
        this.init();
    }

    private init(): void {
        // Create contacts table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phoneNumber TEXT UNIQUE NOT NULL,
                timezone TEXT NOT NULL,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create messages table for custom messages
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS custom_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                target_date TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create settings table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
    }

    // Contact operations
    getAllContacts(): Contact[] {
        const stmt = this.db.prepare('SELECT phoneNumber, timezone, name FROM contacts ORDER BY name');
        return stmt.all() as Contact[];
    }

    addContact(contact: Contact): boolean {
        try {
            const stmt = this.db.prepare(
                'INSERT INTO contacts (phoneNumber, timezone, name) VALUES (?, ?, ?)'
            );
            stmt.run(contact.phoneNumber, contact.timezone, contact.name || null);
            return true;
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return false;
            }
            throw error;
        }
    }

    updateContact(phoneNumber: string, updates: Partial<Contact>): boolean {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.phoneNumber) {
            fields.push('phoneNumber = ?');
            values.push(updates.phoneNumber);
        }
        if (updates.timezone) {
            fields.push('timezone = ?');
            values.push(updates.timezone);
        }
        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }

        if (fields.length === 0) return false;

        values.push(phoneNumber);
        const stmt = this.db.prepare(
            `UPDATE contacts SET ${fields.join(', ')} WHERE phoneNumber = ?`
        );
        const result = stmt.run(...values);
        return result.changes > 0;
    }

    deleteContact(phoneNumber: string): boolean {
        const stmt = this.db.prepare('DELETE FROM contacts WHERE phoneNumber = ?');
        const result = stmt.run(phoneNumber);
        return result.changes > 0;
    }

    contactExists(phoneNumber: string): boolean {
        const stmt = this.db.prepare('SELECT 1 FROM contacts WHERE phoneNumber = ?');
        return stmt.get(phoneNumber) !== undefined;
    }

    getContactByPhone(phoneNumber: string): Contact | undefined {
        const stmt = this.db.prepare('SELECT phoneNumber, timezone, name FROM contacts WHERE phoneNumber = ?');
        return stmt.get(phoneNumber) as Contact | undefined;
    }

    // Message operations
    getLatestCustomMessage(): { message: string, target_date: string } | null {
        const stmt = this.db.prepare('SELECT message, target_date FROM custom_messages ORDER BY created_at DESC LIMIT 1');
        return stmt.get() as { message: string, target_date: string } | null;
    }

    saveCustomMessage(message: string, targetDate: string): void {
        const stmt = this.db.prepare('INSERT INTO custom_messages (message, target_date) VALUES (?, ?)');
        stmt.run(message, targetDate);
    }

    // Settings operations
    getSetting(key: string): string | null {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = stmt.get(key);
        return result ? (result as any).value : null;
    }

    setSetting(key: string, value: string): void {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        stmt.run(key, value);
    }

    // Import from JSON (for migration)
    importFromJSON(data: ContactsData): number {
        let imported = 0;
        for (const contact of data.contacts) {
            if (this.addContact(contact)) {
                imported++;
            }
        }
        return imported;
    }

    // Check if database has any contacts
    hasContacts(): boolean {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM contacts');
        const result = stmt.get() as { count: number };
        return result.count > 0;
    }

    getContactCount(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM contacts');
        const result = stmt.get() as { count: number };
        return result.count;
    }

    close(): void {
        this.db.close();
    }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;

export function getDatabase(): DatabaseManager {
    if (!dbInstance) {
        dbInstance = new DatabaseManager();
    }
    return dbInstance;
}

export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}

