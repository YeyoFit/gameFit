
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

const PRESERVE_EMAIL = 'mazomalote@gmail.com';

async function cleanupUsers() {
    console.log(`--- Cleaning up users (Preserving: ${PRESERVE_EMAIL}) ---`);

    // 1. List all users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No users found.");
        return;
    }

    let deletedCount = 0;

    for (const user of users) {
        if (user.email === PRESERVE_EMAIL) {
            console.log(`✅ Preserving Admin: ${user.email} (${user.id})`);
            // Ensure role is super_admin while we are here
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: 'super_admin' })
                .eq('id', user.id);

            if (updateError) console.error(`Failed to force super_admin rol on ${PRESERVE_EMAIL}`, updateError);
            else console.log(`   -> Confirmed 'super_admin' role in profiles.`);

            continue;
        }

        console.log(`🗑️ Deleting data for: ${user.email} (${user.id})...`);

        // 1. Delete workouts (and exercises via cascade if set, otherwise manual)
        const { error: wError } = await supabase.from('workouts').delete().eq('user_id', user.id);
        if (wError) console.error(`   -> Failed to delete workouts: ${wError.message}`);

        // 2. Delete profile
        const { error: pError } = await supabase.from('profiles').delete().eq('id', user.id);
        if (pError) console.error(`   -> Failed to delete profile: ${pError.message}`);

        // 3. Delete auth user
        console.log(`   -> Deleting auth user...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error(`Failed to delete ${user.email}:`, deleteError.message);
        } else {
            deletedCount++;
        }
    }

    console.log(`\nCleanup complete. Deleted ${deletedCount} users.`);
}

cleanupUsers();
