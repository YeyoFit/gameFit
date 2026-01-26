
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // If available, better for admin writes

// Use Service Key if possible (not usually in client .env, checking generic)
// Fallback to anon key (which might fail RLS if not careful, but 'upsert' to own profile might work)
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function fixProfile() {
    const email = 'mazomalote@gmail.com';
    console.log(`Checking profile for ${email}...`);

    // 1. Get User ID from Auth
    // Note: Admin API needed to search users by email usually, but we can try to "getUser" if we had a session token.
    // Since we are script, we might not find it easily without Service Key or login.
    // Let's try to Login first to get the ID.

    // We don't have the password. 
    // BUT the user IS logged in on the frontend.

    // Let's just blindly try to run a query on profiles if RLS allows reading all (it might not).

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);

    if (error) {
        console.error("Error reading profiles:", error);
    } else {
        console.log("Found profiles:", profiles);
    }

    if (!profiles || profiles.length === 0) {
        console.log("Profile not found in public table. This explains the NULL role.");
        console.log("Cannot fix from here without User ID. Attempting to get User ID via login (if we knew password) or just informing Developer.");
    } else {
        const profile = profiles[0];
        if (profile.role !== 'super_admin') {
            console.log(`User has role '${profile.role}', expected 'super_admin'.`);
        } else {
            console.log("User ALREADY has super_admin role in DB. Why did fetch fail?");
        }
    }
}

fixProfile();
