import { neon } from "@neondatabase/serverless";
import 'dotenv/config';

// create a sql connection
export const sql = neon(process.env.DATABASE_URL);

export const API_URL = process.env.API_URL;

// Initialize database tables
export async function initializeDatabase() {
    try {
        // Set timezone to Europe/Warsaw for consistent timestamps
        await sql`SET timezone = 'Europe/Warsaw'`;
        
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT UNIQUE PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email_token TEXT NOT NULL,
                password TEXT NOT NULL,
                type TEXT DEFAULT 'user',
                state TEXT DEFAULT 'to-confirm',
                phone TEXT,
                register_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `;
        
        // Add new columns to existing users table if they don't exist
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS register_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')`;
        } catch (alterError) {
            // Columns might already exist, which is fine
            console.log('Columns might already exist or alter failed:', alterError.message);
        }
        
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}