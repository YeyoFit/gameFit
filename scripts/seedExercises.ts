import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { SCRAPED_EXERCISES } from '../lib/scrapedExercises';

// 1. Manually load environment variables from .env.local
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf-8');
        envFile.split('\n').forEach(line => {
            // Simple parse: key=value
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                process.env[key] = value;
            }
        });
        console.log('Loaded .env.local');
    } else {
        console.warn('.env.local not found');
    }
} catch (e) {
    console.error('Error loading .env.local', e);
}

// 2. Init Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Seed Function
async function seedExercises() {
    console.log(`Starting seed of ${SCRAPED_EXERCISES.length} exercises...`);

    // Map to match snake_case DB columns if needed, but our schema uses: name, phase, body_part
    // Our source data uses: name, phase, bodyPart
    const formattedData = SCRAPED_EXERCISES.map(ex => ({
        name: ex.name,
        phase: ex.phase,
        body_part: ex.bodyPart, // camelCase to snake_case
    }));

    // Insert in chunks to be safe
    const chunkSize = 50;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < formattedData.length; i += chunkSize) {
        const chunk = formattedData.slice(i, i + chunkSize);

        const { error } = await supabase
            .from('exercises')
            .insert(chunk);

        if (error) {
            console.error(`Error inserting chunk ${i}-${i + chunkSize}:`, error.message);
            errorCount += chunk.length;
        } else {
            insertedCount += chunk.length;
            console.log(`Inserted ${insertedCount}/${formattedData.length}`);
        }
    }

    console.log('-----------------------------------');
    console.log(`Seed finished.`);
    console.log(`Success: ${insertedCount}`);
    console.log(`Errors: ${errorCount}`);
}

seedExercises().catch(console.error);
