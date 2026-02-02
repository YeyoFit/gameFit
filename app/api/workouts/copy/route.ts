
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { sourceWorkoutId, targetDate, userId } = await request.json();

        if (!sourceWorkoutId || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch Source Workout
        const { data: sourceWorkout, error: fetchError } = await supabaseAdmin
            .from('workouts')
            .select('*')
            .eq('id', sourceWorkoutId)
            .single();

        if (fetchError || !sourceWorkout) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
        }

        // 2. Verify Permissions
        // Allow if user owns the workout OR if user is admin (checking profile)
        if (sourceWorkout.user_id !== userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
            if (!isAdmin) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        // 3. Create New Workout
        // Use the same name, or maybe append "(Copy)" if logged on same day? 
        // User asked for "Day 1, 2, 3", implying they want to repeat the SAME structure.
        // So keeping the name is best.
        const { data: newWorkout, error: createError } = await supabaseAdmin
            .from('workouts')
            .insert({
                user_id: userId, // The new workout belongs to the requester
                name: sourceWorkout.name,
                date: targetDate || new Date().toISOString().split('T')[0],
                // We do NOT copy coach_feedback
            })
            .select()
            .single();

        if (createError) {
            console.error("Error creating workout:", createError);
            return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        // 4. Fetch Source Logs
        const { data: sourceLogs } = await supabaseAdmin
            .from('workout_logs')
            .select('*')
            .eq('workout_id', sourceWorkoutId);

        if (sourceLogs && sourceLogs.length > 0) {
            // 5. Prepare New Logs
            const newLogs = sourceLogs.map(log => ({
                workout_id: newWorkout.id,
                exercise_id: log.exercise_id,
                set_number: log.set_number,
                // Copy targets
                target_weight: log.target_weight || log.weight, // Use previous weight as target
                target_reps: log.target_reps || log.reps,       // Use previous reps as target
                // Reset actuals
                weight: log.weight, // Pre-fill with previous weight? Yes, typically helpful.
                reps: log.reps,
                completed: false,   // Reset completion
                notes: log.notes,
                // Preserved
                exercise_order: log.exercise_order,
                tempo: log.tempo,
                rest_time: log.rest_time
            }));

            const { error: logsError } = await supabaseAdmin
                .from('workout_logs')
                .insert(newLogs);

            if (logsError) {
                console.error("Error copying logs:", logsError);
                return NextResponse.json({ error: "Workout created but logs failed" }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            newWorkoutId: newWorkout.id
        });

    } catch (error: any) {
        console.error("Copy API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
