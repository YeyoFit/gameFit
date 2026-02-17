"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, where, orderBy, doc, getDoc, writeBatch } from "firebase/firestore";
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, GripVertical, Download, Check } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type Exercise = {
    id: string;
    name: string;
    body_part: string;
};

type Profile = {
    id: string;
    email: string;
    role?: string;
};

type WorkoutExerciseConfig = {
    exerciseId: string;
    tempId: string; // For list management
    order: string; // "A", "B1", etc.
    sets: number;
    targetReps: string;
    tempo: string;
    rest: string; // e.g. "90s"
};

export default function CreateWorkoutPage() {
    const { user, role } = useAuth();
    const router = useRouter();

    const [workoutName, setWorkoutName] = useState("");
    const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
    const [occurrences, setOccurrences] = useState<number>(1);

    // Client Selection (Admin only)
    const [clients, setClients] = useState<Profile[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("");

    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const [selectedExercises, setSelectedExercises] = useState<WorkoutExerciseConfig[]>([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

    useEffect(() => {
        const fetchExercises = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'exercises'), orderBy('name'));
                const querySnapshot = await getDocs(q);
                const exList: Exercise[] = [];
                querySnapshot.forEach((doc) => {
                    exList.push({ id: doc.id, ...doc.data() } as Exercise);
                });
                setAvailableExercises(exList);
            } catch (error) {
                console.error("Error fetching exercises:", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchClients = async () => {
            if (role === 'admin' || role === 'super_admin') {
                try {
                    // Fetch users from 'users' collection
                    const q = query(collection(db, 'users'), orderBy('email'));
                    const querySnapshot = await getDocs(q);
                    const clientList: Profile[] = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        clientList.push({ id: doc.id, email: data.email, role: data.role });
                    });
                    setClients(clientList);

                    // Default to self if in list, or just empty
                    if (user && !selectedClientId) setSelectedClientId(user.uid);
                } catch (error) {
                    console.error("Error fetching clients:", error);
                }
            } else if (user) {
                // Regular user: can only create for self
                setSelectedClientId(user.uid);
            }
        };

        fetchExercises();
        if (role) fetchClients();

        // Default Name
        setWorkoutName(`Entrenamiento ${new Date().toLocaleDateString()}`);

        const fetchTemplates = async () => {
            try {
                const q = query(collection(db, 'workout_templates'), orderBy('name'));
                const querySnapshot = await getDocs(q);
                const tmpls: any[] = [];
                querySnapshot.forEach((doc) => {
                    tmpls.push({ id: doc.id, ...doc.data() });
                });
                setAvailableTemplates(tmpls);
            } catch (error) {
                console.error("Error fetching templates:", error);
            }
        };
        fetchTemplates();
    }, [role, user]);

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
        try {
            // Fetch items from 'workout_template_exercises' where template_id == templateId
            const q = query(collection(db, 'workout_template_exercises'), where('template_id', '==', templateId));
            const querySnapshot = await getDocs(q);

            const items: any[] = [];
            querySnapshot.forEach((doc) => {
                items.push(doc.data());
            });

            if (items.length > 0) {
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
        } catch (error) {
            console.error("Error loading template:", error);
        } finally {
            setIsTemplateModalOpen(false);
            setLoading(false);
        }
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
            const tmplRef = await addDoc(collection(db, 'workout_templates'), {
                name: templateName,
                created_at: new Date().toISOString()
            });

            // 2. Insert Items (Batch)
            const batch = writeBatch(db);
            const itemsRef = collection(db, 'workout_template_exercises');

            selectedExercises.forEach(ex => {
                const newDocRef = doc(itemsRef); // Generate ID
                batch.set(newDocRef, {
                    template_id: tmplRef.id,
                    exercise_id: ex.exerciseId,
                    exercise_order: ex.order,
                    target_sets: ex.sets,
                    target_reps: ex.targetReps,
                    tempo: ex.tempo,
                    rest_time: ex.rest
                });
            });

            await batch.commit();

            alert("Plantilla guardada correctamente!");

            // Refresh templates list
            const q = query(collection(db, 'workout_templates'), orderBy('name'));
            const querySnapshot = await getDocs(q);
            const newTempls: any[] = [];
            querySnapshot.forEach((doc) => {
                newTempls.push({ id: doc.id, ...doc.data() });
            });
            setAvailableTemplates(newTempls);

        } catch (err: any) {
            console.error(err);
            alert("Error al guardar plantilla: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWorkout = async () => {
        if (!user) return;
        if (selectedExercises.length === 0) {
            alert("Por favor añade al menos un ejercicio.");
            return;
        }

        setSaving(true);
        try {
            // 1. Create Workout
            // Use selectedClientId if Admin, otherwise user.uid
            const targetUserId = (role === 'admin' || role === 'super_admin') ? selectedClientId : user.uid;

            if (!targetUserId) {
                alert("Ningún Cliente Seleccionado");
                setSaving(false);
                return;
            }

            const workoutRef = await addDoc(collection(db, 'workouts'), {
                user_id: targetUserId,
                name: workoutName,
                date: workoutDate,
                occurrences: occurrences,
                created_at: new Date().toISOString(),
                is_feedback_read: true // Default
            });

            // 2. Create Logs (Sets)
            // Use batch for better performance/atomicity
            const batch = writeBatch(db);
            const logsRef = collection(db, 'workout_logs');

            selectedExercises.forEach(ex => {
                // Loop through occurrences (Days)
                for (let d = 1; d <= occurrences; d++) {
                    for (let i = 1; i <= ex.sets; i++) {
                        const newLogRef = doc(logsRef);
                        batch.set(newLogRef, {
                            workout_id: workoutRef.id,
                            exercise_id: ex.exerciseId,
                            set_number: i,
                            day_number: d,
                            exercise_order: ex.order,
                            target_reps: ex.targetReps,
                            tempo: ex.tempo,
                            rest_time: ex.rest,
                            weight: null,
                            reps: null,
                            completed: false,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            });

            await batch.commit();

            router.push(`/workout/${workoutRef.id}`);

        } catch (err: any) {
            console.error(err);
            alert("Error al guardar entrenamiento: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 sm:px-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/dashboard" className="mr-4 text-gray-500 hover:text-primary">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Nuevo Plan de Entrenamiento</h1>
                    </div>
                    <button
                        onClick={handleSaveWorkout}
                        disabled={saving}
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Guardando..." : "Guardar Plan"}
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Meta Info */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Client Selector for Admins */}
                    {(role === 'admin' || role === 'super_admin') && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Asignar a Cliente</label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary bg-yellow-50 font-medium"
                            >
                                <option value="" disabled>Seleccionar Cliente...</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.email} {client.id === user?.uid ? '(Tú)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Entrenamiento</label>
                        <input
                            type="text"
                            value={workoutName}
                            onChange={e => setWorkoutName(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary"
                            placeholder="ej. Hipertrofia Torso"
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
                                // Group by Body Part
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

            {/* Template Selector Modal */}
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
