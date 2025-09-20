import { sql } from "./src/config/db.js";
import fs from "fs";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const fileArg = process.argv[2];
    const migrationFile = fileArg || "database-migration.sql";
    const migrationPath = path.isAbsolute(migrationFile)
        ? migrationFile
        : path.join(__dirname, migrationFile);

    try {
        const migrationSQL = fs.readFileSync(migrationPath, "utf8");
        console.log(`Running migration: ${migrationPath}`);
        await sql.unsafe(migrationSQL);
        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

runMigration(); 