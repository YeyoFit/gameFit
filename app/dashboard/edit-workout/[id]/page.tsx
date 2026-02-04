"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, GripVertical, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type Exercise = {
    id: string;
    name: string;
    body_part: string;
};

type WorkoutExerciseConfig = {
    exerciseId: string;
    tempId: string; // For list management
    order: string; // "A", "B1", etc.
    sets: number;
    targetReps: string;
    tempo: string;
    rest: string; // e.g. "90s"
    order_id?: number; // DB sorting if needed, usually we use order string
};

export default function EditWorkoutPage() {
    const { user, role } = useAuth();
    const router = useRouter();
    const params = useParams();
    const workoutId = params?.id as string;

    const [workoutName, setWorkoutName] = useState("");
    const [workoutDate, setWorkoutDate] = useState("");
    const [occurrences, setOccurrences] = useState<number>(1);
    const [initialExerciseIds, setInitialExerciseIds] = useState<string[]>([]); // To track deletions

    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const [selectedExercises, setSelectedExercises] = useState<WorkoutExerciseConfig[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

    useEffect(() => {
        const init = async () => {
            if (!workoutId) return;
            setLoading(true);

            // 1. Fetch Exercises (Reference)
            const { data: exData } = await supabase.from('exercises').select('*').order('name');
            setAvailableExercises(exData || []);

            // 2. Fetch Templates
            const { data: templData } = await supabase.from('workout_templates').select('*').order('name');
            setAvailableTemplates(templData || []);

            // 3. Fetch Workout Details
            const { data: wo, error: woError } = await supabase
                .from('workouts')
                .select('*')
                .eq('id', workoutId)
                .single();

            if (woError || !wo) {
                alert("Error cargando entrenamiento");
                router.push('/dashboard');
                return;
            }

            setWorkoutName(wo.name);
            setWorkoutDate(wo.date);
            setOccurrences(wo.occurrences || 1);

            // 4. Fetch Logs to Reconstruct State
            // We use Day 1 logs as the "Plan" source of truth
            const { data: logs, error: logsError } = await supabase
                .from('workout_logs')
                .select(`
                    *,
                    exercises (name)
                `)
                .eq('workout_id', workoutId)
                .eq('day_number', 1) // Only fetch Day 1 to build the "Plan"
                .order('exercise_order');

            if (logs) {
                // Group by exercise_id to determine Sets count
                const grouped = new Map<string, WorkoutExerciseConfig>();
                const seenIds = new Set<string>();

                logs.forEach((log: any) => {
                    if (!grouped.has(log.exercise_id)) {
                        grouped.set(log.exercise_id, {
                            exerciseId: log.exercise_id,
                            tempId: Math.random().toString(36).substr(2, 9),
                            order: log.exercise_order || "A",
                            sets: 0, // Will count
                            targetReps: log.target_reps || "8-12",
                            tempo: log.tempo || "3010",
                            rest: log.rest_time || "60s",
                        });
                        seenIds.add(log.exercise_id);
                    }
                    const conf = grouped.get(log.exercise_id)!;
                    conf.sets += 1;
                });

                setSelectedExercises(Array.from(grouped.values()).sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true })));
                setInitialExerciseIds(Array.from(seenIds));
            }

            setLoading(false);
        };

        init();
    }, [workoutId, router, user, role]);

    const addExercise = (ex: Exercise) => {
        const newEx: WorkoutExerciseConfig = {
            exerciseId: ex.id,
            tempId: Math.random().toString(36).substr(2, 9),
            order: "A",
            sets: 3,
            targetReps: "8-12",
            tempo: "3010",
            rest: "60s"
        };
        setSelectedExercises([...selectedExercises, newEx]);
        setIsExerciseModalOpen(false);
    };

    const removeExercise = (tempId: string) => {
        setSelectedExercises(selectedExercises.filter(e => e.tempId !== tempId));
    };

    const updateExercise = (tempId: string, field: keyof WorkoutExerciseConfig, value: any) => {
        setSelectedExercises(prev => prev.map(e =>
            e.tempId === tempId ? { ...e, [field]: value } : e
        ));
    };

    const handleLoadTemplate = async (templateId: string) => {
        setLoading(true);
        const { data: items } = await supabase
            .from('workout_template_exercises')
            .select('*')
            .eq('template_id', templateId);

        if (items) {
            const mapped: WorkoutExerciseConfig[] = items.map(item => ({
                exerciseId: item.exercise_id,
                tempId: Math.random().toString(36).substr(2, 9),
                order: item.exercise_order,
                sets: item.target_sets,
                targetReps: item.target_reps,
                tempo: item.tempo || "3010",
                rest: item.rest_time ? String(item.rest_time) : "60"
            }));
            setSelectedExercises([...selectedExercises, ...mapped]);
        }
        setIsTemplateModalOpen(false);
        setLoading(false);
    };

    const handleSaveTemplate = async () => {
        if (selectedExercises.length === 0) {
            alert("No hay ejercicios para guardar en la plantilla.");
            return;
        }

        const templateName = prompt("Nombre de la nueva plantilla:");
        if (!templateName) return;

        setSaving(true);
        try {
            // 1. Create Template
            const { data: tmpl, error: tError } = await supabase
                .from('workout_templates')
                .insert({ name: templateName })
                .select()
                .single();

            if (tError) throw tError;

            // 2. Insert Items
            const items = selectedExercises.map(ex => ({
                template_id: tmpl.id,
                exercise_id: ex.exerciseId,
                exercise_order: ex.order,
                target_sets: ex.sets,
                target_reps: ex.targetReps,
                tempo: ex.tempo,
                rest_time: ex.rest
            }));

            const { error: itemsError } = await supabase
                .from('workout_template_exercises')
                .insert(items);

            if (itemsError) throw itemsError;

            alert("Plantilla guardada correctamente!");

            // Refresh templates list
            const { data: newTempls } = await supabase.from('workout_templates').select('*').order('name');
            setAvailableTemplates(newTempls || []);

        } catch (err: any) {
            console.error(err);
            alert("Error al guardar plantilla: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateWorkout = async () => {
        if (!workoutId) return;
        if (selectedExercises.length === 0) {
            alert("El entrenamiento debe tener al menos un ejercicio.");
            return;
        }

        if (!confirm("¿Guardar cambios? Si has eliminado ejercicios, se perderán sus registros históricos de este entrenamiento.")) {
            return;
        }

        setSaving(true);
        try {
            // 1. Update Workout Details
            const { error: wError } = await supabase
                .from('workouts')
                .update({
                    name: workoutName,
                    date: workoutDate,
                    occurrences: occurrences
                })
                .eq('id', workoutId);

            if (wError) throw wError;

            // 2. Handle Deletions (Exercises removed from UI)
            const currentIds = new Set(selectedExercises.map(e => e.exerciseId));
            const toDelete = initialExerciseIds.filter(id => !currentIds.has(id));

            if (toDelete.length > 0) {
                await supabase
                    .from('workout_logs')
                    .delete()
                    .eq('workout_id', workoutId)
                    .in('exercise_id', toDelete);
            }

            // 3. Handle Updates & Additions
            // It's safer to re-sync sets logic.
            // Strategy: For each selected exercise:
            // - Check if it exists in DB (checked by initialExerciseIds but we need to know current DB state for sets)
            // Actually, we can just UPSERT strategies? No, 'workout_logs' has no cosmetic ID for "Plan Item".
            // Simpler Strategy:
            // For each exercise in UI:
            //   Fetch existing logs count (Day 1).
            //   Update attributes (order, targets) for ALL logs of this exercise.
            //   Adjust set count (Del exceeding / Add missing).

            // We need to loop carefully because of concurrency.

            for (const ex of selectedExercises) {
                const isNew = !initialExerciseIds.includes(ex.exerciseId);

                if (isNew) {
                    // INSERT logs for ALL days
                    const logsToInsert: any[] = [];
                    for (let d = 1; d <= occurrences; d++) {
                        for (let s = 1; s <= ex.sets; s++) {
                            logsToInsert.push({
                                workout_id: workoutId,
                                exercise_id: ex.exerciseId,
                                set_number: s,
                                day_number: d,
                                exercise_order: ex.order,
                                target_reps: ex.targetReps,
                                tempo: ex.tempo,
                                rest_time: ex.rest,
                                completed: false
                            });
                        }
                    }
                    if (logsToInsert.length > 0) {
                        await supabase.from('workout_logs').insert(logsToInsert);
                    }
                } else {
                    // UPDATE Existing
                    // 1. Update metadata for ALL logs of this exercise in this workout
                    await supabase
                        .from('workout_logs')
                        .update({
                            exercise_order: ex.order,
                            target_reps: ex.targetReps,
                            tempo: ex.tempo,
                            rest_time: ex.rest
                        })
                        .eq('workout_id', workoutId)
                        .eq('exercise_id', ex.exerciseId);

                    // 2. Adjust Sets
                    // Count logs for Day 1
                    const { count } = await supabase
                        .from('workout_logs')
                        .select('*', { count: 'exact', head: true })
                        .eq('workout_id', workoutId)
                        .eq('exercise_id', ex.exerciseId)
                        .eq('day_number', 1);

                    const currentSets = count || 0;

                    if (ex.sets > currentSets) {
                        // Add Sets
                        const setsToAdd = ex.sets - currentSets;
                        const newLogs: any[] = [];
                        for (let d = 1; d <= occurrences; d++) {
                            for (let i = 1; i <= setsToAdd; i++) {
                                newLogs.push({
                                    workout_id: workoutId,
                                    exercise_id: ex.exerciseId,
                                    set_number: currentSets + i,
                                    day_number: d,
                                    exercise_order: ex.order,
                                    target_reps: ex.targetReps,
                                    tempo: ex.tempo,
                                    rest_time: ex.rest,
                                    completed: false
                                });
                            }
                        }
                        await supabase.from('workout_logs').insert(newLogs);

                    } else if (ex.sets < currentSets) {
                        // Remove Excess Sets
                        await supabase
                            .from('workout_logs')
                            .delete()
                            .eq('workout_id', workoutId)
                            .eq('exercise_id', ex.exerciseId)
                            .gt('set_number', ex.sets);
                    }

                    // 3. Adjust Days (if occurrences changed)
                    // If occurrences increased, we need to add full days for existing exercises?
                    // This is complex. If occurrences changed from 1 to 2, we need day 2 logs for this existing exercise.
                    // Let's implement that:

                    // Count unique days for this exercise
                    // Actually simpler: We know 'occurrences' is the target.
                    // We can just try to insert missing days?

                    // Logic: For d = 1 to occurrences:
                    // Check if logs exist for this day/exercise. If not, insert 'ex.sets' logs.
                    // This covers the "New Day" case efficiently.

                    // Optimisation: Do this ONLY if we suspect days changed, but checking per day is safe.
                    // To avoid N queries, we can just assume if we increased 'occurrences', we need to fill gaps.
                    // Keep it simple for now: The "Adjust Sets" above handled Day 1...N for *new sets*.
                    // But if Day 2 didn't exist before, the *existing sets* (1..currentSets) are missing for Day 2.

                    for (let d = 1; d <= occurrences; d++) {
                        const { count: dayCount } = await supabase
                            .from('workout_logs')
                            .select('*', { count: 'exact', head: true })
                            .eq('workout_id', workoutId)
                            .eq('exercise_id', ex.exerciseId)
                            .eq('day_number', d);

                        if ((dayCount || 0) === 0) {
                            // Missing Day! Insert all sets.
                            const missingDayLogs: any[] = [];
                            for (let s = 1; s <= ex.sets; s++) {
                                missingDayLogs.push({
                                    workout_id: workoutId,
                                    exercise_id: ex.exerciseId,
                                    set_number: s,
                                    day_number: d,
                                    exercise_order: ex.order,
                                    target_reps: ex.targetReps,
                                    tempo: ex.tempo,
                                    rest_time: ex.rest,
                                    completed: false
                                });
                            }
                            await supabase.from('workout_logs').insert(missingDayLogs);
                        }
                    }
                }
            }

            // 4. Handle Decreased Occurrences (Days removed)
            // Delete logs where day_number > occurrences
            await supabase
                .from('workout_logs')
                .delete()
                .eq('workout_id', workoutId)
                .gt('day_number', occurrences);

            alert("Plan actualizado correctamente.");
            router.push(`/workout/${workoutId}`);

        } catch (err: any) {
            console.error(err);
            alert("Error al actualizar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-10 text-primary">
                <Loader2 className="w-10 h-10 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 sm:px-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href={`/workout/${workoutId}`} className="mr-4 text-gray-500 hover:text-primary">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Editar Planificación</h1>
                    </div>
                    <button
                        onClick={handleUpdateWorkout}
                        disabled={saving}
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Meta Info */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Entrenamiento</label>
                        <input
                            type="text"
                            value={workoutName}
                            onChange={e => setWorkoutName(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={workoutDate}
                            onChange={e => setWorkoutDate(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Días a realizar</label>
                        <input
                            type="number"
                            min="1"
                            max="7"
                            value={occurrences}
                            onChange={e => setOccurrences(parseInt(e.target.value) || 1)}
                            className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>

                {/* Exercises List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Ejercicios</h2>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setIsTemplateModalOpen(true)}
                                className="text-sm font-bold text-primary flex items-center hover:underline"
                            >
                                <Download className="w-4 h-4 mr-1" /> Cargar Plantilla
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                className="text-sm font-bold text-green-600 flex items-center hover:underline"
                            >
                                <Save className="w-4 h-4 mr-1" /> Guardar como Plantilla
                            </button>
                        </div>
                    </div>

                    {selectedExercises
                        .sort((a, b) => a.order.localeCompare(b.order, undefined, { numeric: true }))
                        .map((ex, idx) => {
                            const ExerciseName = availableExercises.find(a => a.id === ex.exerciseId)?.name || 'Unknown';
                            return (
                                <div key={ex.tempId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center">
                                            <div className="bg-gray-100 p-2 rounded mr-3 text-gray-500 cursor-move">
                                                <GripVertical className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900">{ExerciseName}</h3>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Orden: {ex.order}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeExercise(ex.tempId)}
                                            className="text-red-400 hover:text-red-600 p-2"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Config Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-gray-50 p-4 rounded text-sm">
                                        <div className="col-span-1">
                                            <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Orden</label>
                                            <input
                                                value={ex.order}
                                                onChange={(e) => updateExercise(ex.tempId, 'order', e.target.value)}
                                                className="w-full border rounded p-1"
                                                placeholder="A"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Series</label>
                                            <input
                                                type="number"
                                                value={ex.sets}
                                                onChange={(e) => updateExercise(ex.tempId, 'sets', parseInt(e.target.value) || 1)}
                                                className="w-full border rounded p-1"
                                                min="1"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Reps Objetivo</label>
                                            <input
                                                value={ex.targetReps}
                                                onChange={(e) => updateExercise(ex.tempId, 'targetReps', e.target.value)}
                                                className="w-full border rounded p-1"
                                                placeholder="8-12"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Tempo</label>
                                            <input
                                                value={ex.tempo}
                                                onChange={(e) => updateExercise(ex.tempId, 'tempo', e.target.value)}
                                                className="w-full border rounded p-1"
                                                placeholder="3010"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Descanso</label>
                                            <input
                                                value={ex.rest}
                                                onChange={(e) => updateExercise(ex.tempId, 'rest', e.target.value)}
                                                className="w-full border rounded p-1"
                                                placeholder="60s"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    {/* Add Trigger */}
                    <button
                        onClick={() => setIsExerciseModalOpen(true)}
                        className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-primary hover:border-primary hover:bg-blue-50 transition-all flex flex-col items-center justify-center font-medium"
                    >
                        <Plus className="w-8 h-8 mb-2" />
                        Añadir Ejercicio
                    </button>
                </div>
            </div>

            {/* Exercise Selector Modal */}
            {isExerciseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg">Seleccionar Ejercicio</h3>
                            <button onClick={() => setIsExerciseModalOpen(false)} className="text-gray-500 hover:text-black text-2xl font-light">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-4">
                            {loading ? <p className="text-center py-10">Cargando...</p> : (
                                Object.entries(
                                    availableExercises.reduce((acc, ex) => {
                                        const part = ex.body_part || 'Other';
                                        if (!acc[part]) acc[part] = [];
                                        acc[part].push(ex);
                                        return acc;
                                    }, {} as Record<string, typeof availableExercises>)
                                ).sort((a, b) => a[0].localeCompare(b[0])).map(([part, exercises]) => (
                                    <div key={part}>
                                        <h4 className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded text-sm mb-2 sticky top-0">{part}</h4>
                                        <div className="space-y-2">
                                            {exercises.map(ex => (
                                                <button
                                                    key={ex.id}
                                                    onClick={() => addExercise(ex)}
                                                    className="w-full text-left p-3 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded flex items-center group"
                                                >
                                                    <div className="bg-white p-2 rounded-full mr-3 text-gray-400 group-hover:bg-blue-200 group-hover:text-blue-700 border border-gray-100 shadow-sm">
                                                        <Dumbbell className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-700 group-hover:text-primary">{ex.name}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Template Selector Modal (Reused) */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg">Cargar Plantilla</h3>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-500 hover:text-black text-2xl font-light">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {availableTemplates.length === 0 ? (
                                <p className="text-center text-gray-500">No se encontraron plantillas.</p>
                            ) : (
                                availableTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleLoadTemplate(t.id)}
                                        className="w-full text-left p-4 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-lg group transition-colors"
                                    >
                                        <div className="font-bold text-gray-800 group-hover:text-purple-700">{t.name}</div>
                                        <div className="text-xs text-gray-500">{t.description || "Sin descripción"}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
