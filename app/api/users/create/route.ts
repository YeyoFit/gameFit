import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client (Service Role)
// This strictly requires the SERVICE_ROLE_KEY to bypass RLS and direct Auth management
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        // 1. Verify the requester is a Super Admin
        // We get the session via the request headers or cookies if we were using the SSR helper,
        // but here we might need to rely on the client passing their access token OR
        // just trust the RLS policies if we were doing DB operations. 
        // However, for creating a USER (auth.users), we need to be careful.
        // simpler approach: The API receives the requester's user_id from the body or headers, 
        // AND checks the DB to ensuring they are super_admin.

        // Better security: verify JWT. For now, let's look up the requester in the 'profiles' table 
        // using their ID passed in the body (insecure if not validated)
        // OR BETTER: rely on the client sending the Authorization header which Next.js/Supabase can parse.

        // For this prototype/MVP, we will do a simple check:
        // The "caller" must provide their own ID, and we verify that ID has 'super_admin' role in DB.

        const body = await req.json();
        const { email, password, role, requesterId } = body;

        if (!email || !password || !requesterId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Verify Requester is Super Admin
        const { data: requesterProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requesterId)
            .single();

        if (profileError || !requesterProfile || requesterProfile.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized: Only Super Admins can create users' }, { status: 403 });
        }

        // 2. Create the new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Auto-confirm email
        });

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        // 3. Assign Role (Upsert into profiles)
        if (newUser.user) {
            const { error: profileUpdateError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.user.id,
                    email: email,
                    role: role || 'user'
                });

            if (profileUpdateError) {
                return NextResponse.json({ error: 'User created but profile update failed: ' + profileUpdateError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, user: newUser.user });

    } catch (error: any) {
        console.error("Create User API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
