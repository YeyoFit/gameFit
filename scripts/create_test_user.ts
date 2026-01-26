
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_EMAIL = "test_agent@example.com";
const TEST_PASS = "AgentPassword123!";

async function createTestUser() {
    console.log(`Creating test user: ${TEST_EMAIL}`);

    // 1. Create Auth User
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASS,
        email_confirm: true
    });

    if (createError) {
        // If already exists, just get ID
        console.log("User might already exist, converting to Super Admin...");
        const { data } = await supabase.from('profiles').select('id').eq('email', TEST_EMAIL).single();
        if (data) {
            await makeSuperAdmin(data.id);
            return;
        } else {
            console.error("Could not create or find user:", createError);
            return;
        }
    }

    if (user) {
        console.log(`User created (ID: ${user.id}). Promoting to Super Admin...`);
        // 2. Wait a moment for trigger (if any) or just insert/update profile directly
        await new Promise(r => setTimeout(r, 1000));
        await makeSuperAdmin(user.id);
    }
}

async function makeSuperAdmin(userId: string) {
    // 3. Force role
    const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: TEST_EMAIL,
        role: 'super_admin'
    });

    if (error) console.error("Error setting role:", error);
    else console.log("✅ Success! You can now login as 'test_agent@example.com' with 'AgentPassword123!'");
}

createTestUser();
