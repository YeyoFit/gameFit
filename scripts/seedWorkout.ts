import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf-8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) process.env[match[1].trim()] = match[2].trim();
        });
    }
} catch (e) { console.error(e); }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function seedWorkout() {
    console.log("Seeding Workout...");

    // 1. Get a few exercises
    const { data: exercises } = await supabase.from('exercises').select('id, name').limit(3);

    if (!exercises || exercises.length === 0) {
        console.error("No exercises found. Run seedExercises.ts first.");
        return;
    }

    // 2. Create a Workout
    const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
            name: "Lower Body Destruction",
            date: new Date().toISOString().split('T')[0],
            user_id: '00000000-0000-0000-0000-000000000000', // Mock UUID
        })
        .select()
        .single();

    if (workoutError) {
        console.error("Error creating workout:", workoutError);
        return;
    }

    console.log("Created Workout:", workout.id);

    // 3. Create Logs for each exercise
    const logsToInsert = exercises.map((ex, idx) => ([
        {
            workout_id: workout.id,
            exercise_id: ex.id,
            set_number: 1,
            reps: 10,
            weight: 50,
            notes: "Easy start"
        },
        {
            workout_id: workout.id,
            exercise_id: ex.id,
            set_number: 2,
            reps: 10,
            weight: 55,
            notes: ""
        }
    ])).flat();

    const { error: logsError } = await supabase
        .from('workout_logs')
        .insert(logsToInsert);

    if (logsError) {
        console.error("Error creating logs:", logsError);
    } else {
        console.log(`Added ${logsToInsert.length} logs for ${exercises.length} exercises.`);
    }
}

seedWorkout();
