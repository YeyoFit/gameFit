
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkUsers() {
    console.log('--- Checking User Profiles ---');

    // Get all profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, role');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles?.length || 0} profiles:`);
    profiles?.forEach(p => {
        console.log(`- Email: ${p.email} | Role: ${p.role} | ID: ${p.id}`);
    });

    // Also check auth.users directly via admin api? No, profiles is usually the source of truth for our app logic.
    // But let's see if there are users in auth that are NOT in profiles.
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching auth users:', authError);
    } else {
        console.log('\n--- Checking Auth Users vs Profiles ---');
        users?.forEach(u => {
            const profile = profiles?.find(p => p.id === u.id);
            if (!profile) {
                console.log(`[WARNING] User ${u.email} exists in Auth but MISSING in profiles table!`);
            } else {
                // console.log(`[OK] User ${u.email} matches profile.`);
            }
        });
    }
}

checkUsers();
