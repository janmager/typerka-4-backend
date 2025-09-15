import { neon } from "@neondatabase/serverless";
import 'dotenv/config';

// create a sql connection
export const sql = neon(process.env.DATABASE_URL);

// export const API_URL = "http://localhost:5001";
export const API_URL = 'https://typerka-4-backend.onrender.com';