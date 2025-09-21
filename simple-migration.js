import { sql } from './src/config/db.js';

async function runSimpleMigration() {
    try {
        console.log('🚀 Running simple migration...');
        
        // Add season column
        console.log('Adding season column...');
        await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season INTEGER`;
        
        // Set default value
        console.log('Setting default season to 2025...');
        await sql`UPDATE leagues SET season = 2025 WHERE season IS NULL`;
        
        // Add NOT NULL constraint
        console.log('Adding NOT NULL constraint...');
        await sql`ALTER TABLE leagues ALTER COLUMN season SET NOT NULL`;
        
        // Add index
        console.log('Adding index...');
        await sql`CREATE INDEX IF NOT EXISTS idx_leagues_season ON leagues(season)`;
        
        // Verify
        console.log('Verifying...');
        const result = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'leagues' AND column_name = 'season'
        `;
        
        console.log('Result:', result);
        
        if (result.length > 0) {
            console.log('✅ Migration successful!');
        } else {
            console.log('❌ Migration failed!');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    } finally {
        await sql.end();
    }
}

runSimpleMigration();
