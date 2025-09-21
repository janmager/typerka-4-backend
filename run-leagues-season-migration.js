import { sql } from './src/config/db.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        console.log('🚀 Starting leagues season migration...');
        
        // Read the migration file
        const migrationPath = path.join(process.cwd(), 'leagues-season-migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolon and execute each statement
        console.log('📄 Raw SQL content:', migrationSQL);
        const statements = migrationSQL
            .split('\n')
            .filter(line => line.trim().length > 0 && !line.trim().startsWith('--'))
            .join('\n')
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => {
                const trimmed = stmt.trim();
                return trimmed.length > 0 && 
                       !trimmed.startsWith('--') && 
                       !trimmed.startsWith('COMMENT ON') &&
                       trimmed !== '';
            });
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        console.log('🔍 Statements:', statements);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
            console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
            
            try {
                await sql.unsafe(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            } catch (error) {
                console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                // Continue with other statements unless it's a critical error
                if (error.message.includes('already exists') || error.message.includes('does not exist')) {
                    console.log(`⚠️  Continuing despite warning...`);
                } else {
                    throw error;
                }
            }
        }
        
        // Verify the migration
        console.log('🔍 Verifying migration...');
        
        // First check if table exists
        const tableCheck = await sql`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name = 'leagues'
        `;
        console.log('🔍 Table exists check:', tableCheck);
        
        // Check all columns in leagues table
        const allColumns = await sql`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'leagues'
            ORDER BY ordinal_position
        `;
        console.log('🔍 All columns in leagues table:', allColumns);
        
        // Check specifically for season column
        const result = await sql`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'leagues' AND column_name = 'season'
        `;
        
        console.log('🔍 Season column check result:', result);
        
        if (result.length > 0) {
            console.log('✅ Season column successfully added to leagues table');
            console.log('📊 Column details:', result[0]);
        } else {
            throw new Error('Season column was not found after migration');
        }
        
        // Check existing data
        const countResult = await sql`
            SELECT COUNT(*) as total, COUNT(season) as with_season, 
                   MIN(season) as min_season, MAX(season) as max_season
            FROM leagues
        `;
        
        console.log('📈 Data verification:', countResult[0]);
        
        console.log('🎉 Leagues season migration completed successfully!');
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

runMigration();
