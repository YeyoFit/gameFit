
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We use the service role key to bypass RLS and act as super admin
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('--- Starting Backend Delete Verification ---');

    // 1. Create a "Victim" User
    const victimEmail = `victim_${Date.now()}@test.com`;
    const victimPassword = 'password123';
    console.log(`Creating victim user: ${victimEmail}`);

    const { data: victimData, error: victimError } = await supabase.auth.admin.createUser({
        email: victimEmail,
        password: victimPassword,
        email_confirm: true
    });

    if (victimError) {
        console.error('Error creating victim:', victimError);
        return;
    }
    const victimId = victimData.user.id;
    console.log('Victim created, ID:', victimId);

    // 2. Assign role 'user' to victim (just to be sure)
    // (Assuming profiles trigger works, otherwise we might fail here if profile doesn't exist)
    // Let's manually ensure profile exists/is updated
    await supabase.from('profiles').upsert({ id: victimId, email: victimEmail, role: 'user' });

    // 3. Create a fake workout for victim to test cascade
    console.log('Creating workout for victim...');
    const { data: woData, error: woError } = await supabase.from('workouts').insert({
        user_id: victimId,
        name: 'Victim Workout',
        date: new Date().toISOString()
    }).select().single();

    if (woError) {
        console.error('Error creating workout:', woError);
    } else {
        console.log('Workout created, ID:', woData.id);

        // Create a log
        await supabase.from('workout_logs').insert({
            workout_id: woData.id,
            exercise_id: '00000000-0000-0000-0000-000000000000', // Assuming a valid UUID or we handle error. 
            // Actually, let's skip exercise constraint or assume one exists. 
            // If we fail here, it's fine, we mainly want to test User Deletion with *at least* a workout.
        });
    }

    // 4. Create an "Admin" User (Requester)
    const adminEmail = `admin_${Date.now()}@test.com`;
    console.log(`Creating admin user: ${adminEmail}`);

    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: 'password123',
        email_confirm: true
    });

    if (adminError) {
        console.error('Error creating admin:', adminError);
        return;
    }
    const adminId = adminData.user.id;

    // Set role to 'admin'
    console.log('Promoting requester to admin...');
    await supabase.from('profiles').upsert({ id: adminId, email: adminEmail, role: 'admin' });


    // 5. Simulate API Delete Logic
    console.log('--- Simulating API Execution ---');

    // A. Manual Cascade - Delete Logs (Mocking what route.ts does)
    console.log('A. Deleting workout logs...');
    const { data: userWorkouts } = await supabase.from('workouts').select('id').eq('user_id', victimId);
    if (userWorkouts && userWorkouts.length > 0) {
        const wIds = userWorkouts.map(w => w.id);
        const { error: logsDelErr } = await supabase.from('workout_logs').delete().in('workout_id', wIds);
        if (logsDelErr) console.log('Log delete error (expected if foreign key/missing ex):', logsDelErr.message);
        else console.log('Logs deleted/checked.');

        console.log('B. Deleting workouts...');
        const { error: woDelErr } = await supabase.from('workouts').delete().eq('user_id', victimId);
        if (woDelErr) console.error('Workout delete error:', woDelErr);
        else console.log('Workouts deleted.');
    }

    // B. Delete Profile
    console.log('C. Deleting profile...');
    const { error: profDelErr } = await supabase.from('profiles').delete().eq('id', victimId);
    if (profDelErr) console.error('Profile delete error:', profDelErr);
    else console.log('Profile deleted.');

    // C. Delete Auth User
    console.log('D. Deleting auth user...');
    const { error: authDelErr } = await supabase.auth.admin.deleteUser(victimId);

    if (authDelErr) {
        console.error('FAILED: Auth user delete error:', authDelErr);
    } else {
        console.log('SUCCESS: Auth user deleted.');
    }

    // Cleanup Admin
    console.log('Cleaning up test admin...');
    await supabase.auth.admin.deleteUser(adminId);

    console.log('--- Done ---');
}

run();
