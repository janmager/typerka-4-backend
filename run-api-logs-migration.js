import { readFileSync } from 'fs';
import { sql } from './src/config/db.js';

async function runApiLogsMigration() {
    try {
        console.log('Starting API football logs migration...');
        
        // Read the migration file
        const migrationSQL = readFileSync('./api-football-logs-migration.sql', 'utf8');
        
        // Execute the migration
        await sql.unsafe(migrationSQL);
        
        console.log('✅ API football logs migration completed successfully!');
        console.log('Table "api_football_logs" has been created with the following columns:');
        console.log('- id (SERIAL PRIMARY KEY)');
        console.log('- description (TEXT)');
        console.log('- created_at (TIMESTAMP WITH TIME ZONE)');
        console.log('- url (TEXT)');
        
        // Verify table creation
        const tableCheck = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'api_football_logs' 
            ORDER BY ordinal_position
        `;
        
        console.log('\nTable structure verified:');
        tableCheck.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runApiLogsMigration();


