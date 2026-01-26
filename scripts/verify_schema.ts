
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local manually since we are running a script
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    // Fallback to .env
    dotenv.config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking for prescription columns in workout_logs...");

    // Attempt to select the new columns
    const { data, error } = await supabase
        .from('workout_logs')
        .select('target_reps, tempo, rest_time, exercise_order')
        .limit(1);

    if (error) {
        console.error("❌ Schema verification FAILED:", error.message);
        console.log("You probably need to run 'scripts/update_schema_prescription.sql' in your Supabase SQL Editor.");
    } else {
        console.log("✅ Schema verification PASSED. Columns exist.");
    }
}

checkSchema();
