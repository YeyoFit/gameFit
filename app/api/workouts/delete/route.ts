
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create a Supabase client with the SERVICE ROLE key
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { workoutId, requesterId } = await request.json();

        if (!workoutId || !requesterId) {
            return NextResponse.json({ error: 'Missing workoutId or requesterId' }, { status: 400 });
        }

        // 1. Verify Verification (Admin only)
        const { data: requesterProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requesterId)
            .single();

        if (profileError || !requesterProfile) {
            return NextResponse.json({ error: 'Unauthorized: Could not verify requester role' }, { status: 401 });
        }

        const { role } = requesterProfile;
        if (role !== 'admin' && role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized: Insufficient permissions' }, { status: 403 });
        }

        // 2. Perform Delete
        // Manual Cascade: Delete logs first
        const { error: deleteLogsError } = await supabaseAdmin
            .from('workout_logs')
            .delete()
            .eq('workout_id', workoutId);

        if (deleteLogsError) {
            console.log("Error deleting logs (might be empty):", deleteLogsError);
        }

        // Delete Workout
        const { error: deleteError } = await supabaseAdmin
            .from('workouts')
            .delete()
            .eq('id', workoutId);

        if (deleteError) {
            console.error("Error deleting workout:", deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Workout deleted successfully' });

    } catch (error: any) {
        console.error("Delete Workout API error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
