import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role Client
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
        const { email, password } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        // 1. Fetch User ID
        const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();

        // Simple find (not efficient for millions, fine for dev)
        const targetUser = users?.find(u => u.email === email);

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found in Auth' }, { status: 404 });
        }

        console.log("Found user:", targetUser.id);

        // 2. Update Password if provided
        if (password) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                targetUser.id,
                { password: password, email_confirm: true } // Auto confirm if resetting
            );

            if (updateError) {
                return NextResponse.json({ error: 'Password Update Failed: ' + updateError.message }, { status: 500 });
            }
        }

        // 3. Try to Update Profile to super_admin
        // This will FAIL if the Check Constraint hasn't been updated
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: targetUser.id,
                email: email,
                role: 'super_admin'
            })
            .select()
            .single();

        if (error) {
            console.error("Profile Upsert Error:", error);
            return NextResponse.json({
                success: false,
                stage: 'upsert_profile',
                error: error.message,
                details: error
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: data });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
