"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { RestTimer } from "@/components/workout/RestTimer";
import { ArrowLeft, Loader2, Calendar, Trophy } from "lucide-react"; // Added Trophy
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { USER_PROFILE, Exercise, LogSet } from "@/lib/mockData";
import { MessageSquare, Save } from "lucide-react";
import confetti from "canvas-confetti"; // Imported confetti

type DbWorkout = {
    id: string;
    name: string;
    date: string;
    coach_feedback?: string;
};

// Modified: Track Max Weight instead of just generic object
type HistoryMap = Record<string, { maxWeight: number }>;

export default function WorkoutExecutionPage() {
    const params = useParams();
    const router = useRouter();
    const workoutId = params?.id as string;

    const [workout, setWorkout] = useState<DbWorkout | null>(null);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { role } = useAuth();

    // Feedback State
    const [feedback, setFeedback] = useState("");
    const [savingFeedback, setSavingFeedback] = useState(false);

    // History State
    const [history, setHistory] = useState<HistoryMap>({});

    // PR State
    const [newPRs, setNewPRs] = useState<number>(0);

    // Timer State
    const [timerOpen, setTimerOpen] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(60);
    const [timerExerciseName, setTimerExerciseName] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!workoutId) return;

        async function fetchData() {
            setLoading(true);

            // 1. Fetch Workout Details
            const { data: woData, error: woError } = await supabase
                .from('workouts')
                .select('*')
                .eq('id', workoutId)
                .single();

            if (woError) {
                console.error("Error fetching workout:", woError);
                setLoading(false);
                return;
            }

            setWorkout(woData);
            setFeedback(woData.coach_feedback || "");

            // 2. Fetch Logs with Exercise details
            const { data: logsData, error: logsError } = await supabase
                .from('workout_logs')
                .select(`
                    id,
                    set_number,
                    weight,
                    reps,
                    notes,
                    completed,
                    exercise_id,
                    target_reps,
                    target_weight,
                    tempo,
                    rest_time,
                    exercise_order,
                    exercises (
                        id,
                        name,
                        phase,
                        body_part
                    )
                `)
                .eq('workout_id', workoutId)
                .order('set_number', { ascending: true });

            if (logsError) {
                console.error("Error fetching logs:", logsError);
            } else if (logsData) {
                // 3. Group logs by Exercise
                const grouped = new Map<string, Exercise>();

                logsData.forEach((log: any) => {
                    const exId = log.exercise_id;
                    const exDetails = log.exercises;

                    if (!grouped.has(exId)) {
                        grouped.set(exId, {
                            id: exId,
                            name: exDetails.name,
                            order: log.exercise_order || "A",
                            setsTarget: "",
                            repsTarget: log.target_reps || "8-12",
                            tempo: log.tempo || "2010",
                            rest: parseInt(log.rest_time) || 60,
                            notes: log.notes || "",
                            logs: []
                        });
                    }

                    const group = grouped.get(exId)!;

                    const isCompleted = log.completed || false;

                    group.logs.push({
                        setNumber: log.set_number,
                        weight: isCompleted ? log.weight : null,
                        reps: isCompleted ? log.reps : null,
                        prevWeight: undefined,
                        prevReps: undefined,
                        completed: isCompleted,
                        isPR: false // Initialize PR status
                    });
                });

                // Update setsTarget based on actual logs count
                for (const group of grouped.values()) {
                    group.setsTarget = group.logs.length.toString();
                }

                // 4. Fetch History (Max Weight Ever)
                const uniqueExerciseIds = Array.from(grouped.values()).map(e => e.id);
                const historyMap: HistoryMap = {};

                await Promise.all(uniqueExerciseIds.map(async (exId) => {
                    // Fetch highest weight EVER for this exercise recorded up to now
                    // Note: In a real simplified SQL without aggregates, we sort by weight desc
                    const { data: histLogs } = await supabase
                        .from('workout_logs')
                        .select('weight')
                        .eq('exercise_id', exId)
                        .eq('completed', true)
                        // Important: exclude current workout if we are editing it, to allow re-breaking PRs?
                        // Actually, if we compare against ALL history including before today, 
                        // we really want "Best Weight Before TODAY" usually.
                        // But let's say "Best Weight Ever" found in logs.
                        .neq('workout_id', workoutId) // Exclude current session's logs from "History"
                        .order('weight', { ascending: false })
                        .limit(1);

                    if (histLogs && histLogs.length > 0) {
                        historyMap[exId] = {
                            maxWeight: histLogs[0].weight || 0
                        };
                    } else {
                        historyMap[exId] = { maxWeight: 0 };
                    }
                }));

                setHistory(historyMap);

                // Merge History into Exercises only for "prev logs" visualization if we wanted
                // But for now we just store it to compare
                const initializedExercises = Array.from(grouped.values()).sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true }));
                setExercises(initializedExercises);
            }

            setLoading(false);
        }

        fetchData();
    }, [workoutId]);

    const handleLogChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'completed', value: number | boolean | null) => {
        setExercises(prev => prev.map(ex => {
            if (ex.id !== exerciseId) return ex;

            const newLogs = [...ex.logs];
            const currentLog = { ...newLogs[setIndex], [field]: value };
            newLogs[setIndex] = currentLog;

            // Check if we should trigger timer & PR check (if completing)
            // Only trigger if manually marking completed and it wasn't before
            if (field === 'completed' && value === true) {
                // 1. Timer Logic
                if (ex.rest > 0) {
                    setTimerSeconds(ex.rest);
                    setTimerExerciseName(ex.name);
                    setTimerOpen(true);
                }

                // 2. PR Logic
                const liftedWeight = Number(currentLog.weight || 0);
                const historicalMax = history[exerciseId]?.maxWeight || 0;

                // Simple PR Check: Lifted > Max Ever
                // Also ensure we haven't already marked it as PR to avoid double counting if user toggles off/on
                if (liftedWeight > historicalMax && liftedWeight > 0) {
                    if (!currentLog.isPR) {
                        // It IS a new PR!
                        triggerConfetti();
                        currentLog.isPR = true;
                        setNewPRs(p => p + 1);
                    }
                }
            } else if (field === 'completed' && value === false) {
                // Creating logic to "un-PR" if they uncheck?
                // Maybe too complex for now, let's keep it simple. PR count might be slightly off if they toggle a lot.
                if (currentLog.isPR) {
                    currentLog.isPR = false;
                    setNewPRs(p => Math.max(0, p - 1));
                }
            }

            return { ...ex, logs: newLogs };
        }));
    };

    const triggerConfetti = () => {
        const end = Date.now() + 1000;
        const colors = ['#2563eb', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    const handleSaveWorkout = async () => {
        if (!workout) return;
        setSaving(true);

        try {
            const logsToUpdate: any[] = [];

            exercises.forEach(ex => {
                ex.logs.forEach(log => {
                    logsToUpdate.push({
                        workout_id: workout.id,
                        exercise_id: ex.id,
                        set_number: log.setNumber,
                        weight: log.weight,
                        reps: log.reps,
                        completed: log.completed || false
                    });
                });
            });

            for (const log of logsToUpdate) {
                const { error } = await supabase.from('workout_logs')
                    .update({
                        weight: log.weight,
                        reps: log.reps,
                        completed: log.completed
                    })
                    .eq('workout_id', log.workout_id)
                    .eq('exercise_id', log.exercise_id)
                    .eq('set_number', log.set_number);

                if (error) console.error("Error saving log:", error);
            }

            // Optional: Show PR Summary before leaving?
            if (newPRs > 0) {
                alert(`Great job! You set ${newPRs} new Personal Records today! 🏆`);
            }
            router.push('/dashboard');

        } catch (error) {
            console.error(error);
            alert("Failed to save.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFeedback = async () => {
        if (!workout) return;
        setSavingFeedback(true);
        const { error } = await supabase
            .from('workouts')
            .update({
                coach_feedback: feedback,
                is_feedback_read: false // Mark unread so user sees it
            })
            .eq('id', workout.id);

        if (error) alert("Error saving feedback");
        setSavingFeedback(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center text-primary">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="font-bold">Loading Workout...</p>
                </div>
            </div>
        );
    }

    if (!workout) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">Workout Not Found</h1>
                <Link href="/dashboard" className="text-primary hover:underline">Return to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="py-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Top Nav / Breadcrumb */}
            <div className="flex items-center mb-6 justify-between">
                <Link href="/dashboard" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Dashboard</span>
                </Link>

                <div className="flex items-center gap-2">
                    {newPRs > 0 && (
                        <div className="flex items-center text-yellow-500 font-bold bg-yellow-50 px-3 py-1 rounded-full animate-pulse">
                            <Trophy className="w-4 h-4 mr-1" />
                            <span>{newPRs} PRs Today!</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {newPRs > 0 && (
                            <div className="flex items-center text-yellow-500 font-bold bg-yellow-50 px-3 py-1 rounded-full animate-pulse">
                                <Trophy className="w-4 h-4 mr-1" />
                                <span>{newPRs} PRs Today!</span>
                            </div>
                        )}

                        {(role === 'admin' || role === 'super_admin') && (
                            <div className="flex items-center ml-4">
                                {confirmDelete ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                // Perform actual delete
                                                const { data: { user } } = await supabase.auth.getUser();

                                                try {
                                                    setLoading(true);
                                                    const res = await fetch('/api/workouts/delete', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            workoutId: workout.id,
                                                            requesterId: user?.id
                                                        })
                                                    });

                                                    if (res.ok) {
                                                        alert("SUCCESS: Workout deleted");
                                                        router.push('/dashboard');
                                                    } else {
                                                        const d = await res.json();
                                                        alert(`FAILED: ${res.status} - ${JSON.stringify(d)}`);
                                                        setConfirmDelete(false); // Reset on fail
                                                    }
                                                } catch (e: any) {
                                                    alert(`CRITICAL ERROR: ${e.message}`);
                                                    setConfirmDelete(false);
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-bold transition-colors mr-2"
                                        >
                                            CONFIRM DELETE?
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setConfirmDelete(false);
                                            }}
                                            className="text-gray-500 hover:text-gray-700 text-sm font-medium underline"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setConfirmDelete(true);
                                        }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-bold transition-colors"
                                    >
                                        Delete Workout
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="mb-10">
                <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">{workout.name}</h1>
                <div className="flex items-center text-muted text-lg space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>{workout.date}</span>
                </div>
            </div>

            {/* Session Inputs (Header Card) */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-10 flex flex-wrap gap-8 items-end">
                <div className="flex flex-col">
                    <span className="text-primary font-bold mb-1">Body Weight</span>
                    <div className="flex items-center">
                        <input
                            defaultValue={USER_PROFILE.bodyWeight}
                            className="border border-gray-300 rounded px-3 py-2 w-32 font-bold text-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        <div className="ml-4 flex items-center space-x-4">
                            <span className="font-bold text-primary bg-blue-100 px-2 py-1 rounded text-sm">
                                {USER_PROFILE.units}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 text-right">
                    <button
                        onClick={handleSaveWorkout}
                        disabled={saving}
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-3 px-6 rounded shadow flex items-center justify-center ml-auto"
                    >
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {saving ? "Saving..." : "Finish Workout"}
                    </button>
                </div>
            </div>

            {/* Exercises List */}
            <div className="space-y-4">
                {exercises.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded border border-dashed border-gray-300 text-muted">
                        No exercises logged for this workout yet.
                    </div>
                ) : (
                    exercises.map((ex, idx) => (
                        <div key={ex.id}>
                            <ExerciseCard
                                exercise={ex}
                                onLogChange={handleLogChange}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Coach Feedback Section */}
            <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                    <MessageSquare className="w-5 h-5 text-primary mr-2" />
                    <h3 className="text-xl font-bold text-primary">Coach Feedback</h3>
                </div>

                {(role === 'admin' || role === 'super_admin') ? (
                    <div className="space-y-4">
                        <textarea
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                            className="w-full h-32 p-4 border border-blue-200 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Write your feedback for the athlete here..."
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveFeedback}
                                disabled={savingFeedback}
                                className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                            >
                                {savingFeedback ? "Saving..." : "Send Feedback"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-blue max-w-none">
                        {feedback ? (
                            <p className="whitespace-pre-wrap text-gray-800 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                                {feedback}
                            </p>
                        ) : (
                            <p className="text-gray-500 italic">No feedback received yet.</p>
                        )}
                    </div>
                )}
            </div>
            {/* Rest Timer */}
            <RestTimer
                isOpen={timerOpen}
                onClose={() => setTimerOpen(false)}
                initialSeconds={timerSeconds}
                exerciseName={timerExerciseName}
            />
        </div>
    );
}
