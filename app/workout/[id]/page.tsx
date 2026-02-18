"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, writeBatch, documentId } from "firebase/firestore";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { RestTimer } from "@/components/workout/RestTimer";
import { ArrowLeft, Loader2, Calendar, Trophy } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { USER_PROFILE, Exercise, LogSet } from "@/lib/mockData";
import { MessageSquare, Save } from "lucide-react";
import confetti from "canvas-confetti";

type DbWorkout = {
    id: string;
    name: string;
    date: string;
    occurrences: number;
    coach_feedback?: string;
};

// Modified: Track Max Weight instead of just generic object
type HistoryMap = Record<string, { maxWeight: number }>;

export default function WorkoutExecutionPage() {
    const params = useParams();
    const router = useRouter();
    const workoutId = params?.id as string;

    const [workout, setWorkout] = useState<DbWorkout | null>(null);
    // Modified: exercises is now derived or we just store "current day" exercises?
    // Let's store ALL days data to allow switching without refetching.
    const [dayData, setDayData] = useState<Record<number, Exercise[]>>({});
    const [activeDay, setActiveDay] = useState(1);

    // Legacy support: if we just use 'exercises' for current view, it might be simpler?
    // But we need to switch context.
    // Let's use a computed property for rendering.

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { role, user } = useAuth(); // Needed user for deletion

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
            const firestore = db;
            if (!firestore) {
                setLoading(false);
                return;
            }
            setLoading(true);

            try {
                // 1. Fetch Workout Details from Firestore
                const workoutRef = doc(firestore, 'workouts', workoutId);
                const workoutSnap = await getDoc(workoutRef);

                if (!workoutSnap.exists()) {
                    console.error("Workout not found");
                    setLoading(false);
                    return;
                }

                const woData = { id: workoutSnap.id, ...workoutSnap.data() } as DbWorkout;
                setWorkout(woData);
                setFeedback(woData.coach_feedback || "");

                // 2. Fetch Logs
                const logsRef = collection(firestore, 'workout_logs');
                const qLogs = query(
                    logsRef,
                    where('workout_id', '==', workoutId)
                );

                const logsSnapshot = await getDocs(qLogs);
                const logsData: any[] = [];
                const uniqueExerciseIds = new Set<string>();

                logsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    logsData.push({ id: doc.id, ...data });
                    if (data.exercise_id) uniqueExerciseIds.add(data.exercise_id);
                });

                // Sort logs by set_number in memory
                logsData.sort((a, b) => (a.set_number || 0) - (b.set_number || 0));

                // 3. Fetch Exercise Details (Manual Join)
                const exercisesMap = new Map<string, any>();
                if (uniqueExerciseIds.size > 0) {
                    // Firestore 'in' query supports up to 10 items. If > 10, need multiple queries.
                    // For now assuming < 10 unique exercises per workout or just fetch all exercises if simple.
                    // Better approach: fetch specific IDs in batches of 10.
                    const ids = Array.from(uniqueExerciseIds);
                    const chunks = [];
                    for (let i = 0; i < ids.length; i += 10) {
                        chunks.push(ids.slice(i, i + 10));
                    }

                    for (const chunk of chunks) {
                        const qEx = query(collection(firestore, 'exercises'), where(documentId(), 'in', chunk));
                        const exSnaps = await getDocs(qEx);
                        exSnaps.forEach((doc) => {
                            exercisesMap.set(doc.id, { id: doc.id, ...doc.data() });
                        });
                    }
                }

                // 4. Map Logs + Exercises to structure
                const daysMap: Record<number, Exercise[]> = {};
                const totalDays = woData.occurrences || 1;
                for (let i = 1; i <= totalDays; i++) {
                    daysMap[i] = [];
                }

                const dayGroups = new Map<number, Map<string, Exercise>>();

                logsData.forEach((log) => {
                    const d = log.day_number || 1;
                    if (!dayGroups.has(d)) {
                        dayGroups.set(d, new Map());
                    }
                    const grouped = dayGroups.get(d)!;

                    const exId = log.exercise_id;
                    const exDetails = exercisesMap.get(exId) || { name: 'Unknown Exercise', body_part: 'Unknown' };

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
                        id: log.id, // Store doc ID for updates
                        setNumber: log.set_number,
                        weight: isCompleted ? log.weight : null,
                        reps: isCompleted ? log.reps : null,
                        prevWeight: undefined,
                        prevReps: undefined,
                        completed: isCompleted,
                        isPR: false,
                        videoUrl: log.video_url,
                        coachComment: log.coach_comment
                    });
                });

                dayGroups.forEach((groups, dayNum) => {
                    for (const group of groups.values()) {
                        group.setsTarget = group.logs.length.toString();
                    }
                    daysMap[dayNum] = Array.from(groups.values()).sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true }));
                });

                for (let i = 1; i <= totalDays; i++) {
                    if (!daysMap[i]) daysMap[i] = [];
                }

                setDayData(daysMap);

                // 5. Fetch History (Max Weight Ever)
                // This is tricky in NoSQL without heavy indexing.
                // We'll skip complex history fetch for now or implement a simplified version later.
                // If we really need it, we'd query workout_logs where exercise_id == X and completed == true, order by weight desc limit 1.
                // But doing this for ALL exercises is N queries.
                // Optimization: Maybe only fetch for current exercise on focus?
                // For now, empty map.
                setHistory({});

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [workoutId]);

    const handleLogChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'completed' | 'videoUrl' | 'coachComment', value: any) => {
        setDayData(prev => {
            const currentDayExercises = prev[activeDay] ? [...prev[activeDay]] : [];
            const exIndex = currentDayExercises.findIndex(e => e.id === exerciseId);

            if (exIndex === -1) return prev;

            const newEx = { ...currentDayExercises[exIndex] };
            const newLogs = [...newEx.logs];
            const currentLog = { ...newLogs[setIndex], [field]: value };
            newLogs[setIndex] = currentLog;
            newEx.logs = newLogs;

            currentDayExercises[exIndex] = newEx;

            // Side Effects (Timer, PR) - kept roughly same but adapting context
            if (field === 'completed' && value === true) {
                if (newEx.rest > 0) {
                    setTimerSeconds(newEx.rest);
                    setTimerExerciseName(newEx.name);
                    setTimerOpen(true);
                }
                const liftedWeight = Number(currentLog.weight || 0);
                const historicalMax = history[exerciseId]?.maxWeight || 0;
                if (liftedWeight > historicalMax && liftedWeight > 0) {
                    if (!currentLog.isPR) {
                        triggerConfetti();
                        currentLog.isPR = true;
                        setNewPRs(p => p + 1);
                    }
                }
            } else if (field === 'completed' && value === false) {
                if (currentLog.isPR) {
                    currentLog.isPR = false;
                    setNewPRs(p => Math.max(0, p - 1));
                }
            }

            return {
                ...prev,
                [activeDay]: currentDayExercises
            };
        });
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
        const firestore = db;
        if (!workout || !firestore) return;
        setSaving(true);

        try {
            const batch = writeBatch(firestore);
            const logsRef = collection(firestore, 'workout_logs');
            const exercisesToSave = dayData[activeDay] || [];
            let updateCount = 0;

            exercisesToSave.forEach(ex => {
                ex.logs.forEach(log => {
                    // Update only if log has an ID (it should)
                    if (log.id) { // Use ID from our state (added in fetch)
                        const logDocRef = doc(logsRef, log.id); // Assuming log.id is stored
                        batch.update(logDocRef, {
                            weight: log.weight,
                            reps: log.reps,
                            completed: log.completed || false,
                            video_url: log.videoUrl || null
                        });
                        updateCount++;
                    } else {
                        // If for some reason ID is missing (should not happen if fetched correctly)
                        console.warn("Log missing ID, skipping update", log);
                    }
                });
            });

            if (updateCount > 0) {
                await batch.commit();
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
        const firestore = db;
        if (!workout || !firestore) return;
        setSavingFeedback(true);
        try {
            const workoutRef = doc(firestore, 'workouts', workout.id);
            await updateDoc(workoutRef, {
                coach_feedback: feedback,
                is_feedback_read: false
            });
        } catch (error) {
            console.error("Error saving feedback:", error);
            alert("Error saving feedback");
        } finally {
            setSavingFeedback(false);
        }
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
                            <div className="flex items-center ml-4 space-x-2">
                                <Link
                                    href={`/dashboard/edit-workout/${workout.id}`}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm font-bold transition-colors flex items-center"
                                >
                                    <MessageSquare className="w-4 h-4 mr-1" /> {/* Using MessageSquare as placeholder or import Edit */}
                                    Editar Plan
                                </Link>
                                {confirmDelete ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                const firestore = db;
                                                if (!firestore) return;
                                                try {
                                                    setLoading(true);
                                                    // Direct Delete from Client (since we have logic in frontend)
                                                    // This skips server-side complex checks but for migration speed is better.
                                                    // TODO: Move to Cloud Function for security if needed later.

                                                    // Delete logs first (optional if we don't care about orphans, but good practice)
                                                    const logsRef = collection(firestore, 'workout_logs');
                                                    const q = query(logsRef, where('workout_id', '==', workout.id));
                                                    const logsSnap = await getDocs(q);
                                                    const batch = writeBatch(firestore);
                                                    logsSnap.forEach(doc => {
                                                        batch.delete(doc.ref);
                                                    });
                                                    // Delete workout
                                                    const woRef = doc(firestore, 'workouts', workout.id);
                                                    batch.delete(woRef);

                                                    await batch.commit();

                                                    alert("SUCCESS: Workout deleted");
                                                    router.push('/dashboard');
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
            <div className="mb-6">
                <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">{workout.name}</h1>
                <div className="flex items-center text-muted text-lg space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>{workout.date}</span>
                    {workout.occurrences > 1 && (
                        <span className="bg-blue-100 text-primary text-xs font-bold px-2 py-1 rounded ml-2">
                            {workout.occurrences} Días
                        </span>
                    )}
                </div>
            </div>

            {/* Day Tabs */}
            {(workout.occurrences > 1) && (
                <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
                    {Array.from({ length: workout.occurrences }, (_, i) => i + 1).map(d => (
                        <button
                            key={d}
                            onClick={() => setActiveDay(d)}
                            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeDay === d
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            Día {d}
                        </button>
                    ))}
                </div>
            )}


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
                {(!dayData[activeDay] || dayData[activeDay].length === 0) ? (
                    <div className="text-center py-10 bg-gray-50 rounded border border-dashed border-gray-300 text-muted">
                        No exercises logged for Day {activeDay}.
                    </div>
                ) : (
                    dayData[activeDay].map((ex, idx) => (
                        <div key={ex.id}>
                            <ExerciseCard
                                exercise={ex}
                                onLogChange={handleLogChange}
                                isCoach={role === 'admin' || role === 'super_admin'}
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
