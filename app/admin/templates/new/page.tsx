"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, addDoc, doc, writeBatch } from "firebase/firestore";
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, GripVertical, Layers } from "lucide-react";
import Link from "next/link";

type Exercise = {
    id: string;
    name: string;
    body_part: string;
};

type TemplateExerciseConfig = {
    exerciseId: string;
    tempId: string;
    order: string;
    sets: number;
    targetReps: string;
    tempo: string;
    rest: number; // Storing as number for consistency with schema
    notes: string;
};

export default function NewTemplatePage() {
    const router = useRouter();

    const [templateName, setTemplateName] = useState("");
    const [description, setDescription] = useState("");

    // Available Exercises for Selector
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

    // Selected
    const [selectedExercises, setSelectedExercises] = useState<TemplateExerciseConfig[]>([]);

    // UI
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

    useEffect(() => {
        const fetchExercises = async () => {
            const firestore = db;
            if (!firestore) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const q = query(collection(firestore, 'exercises'));
                const querySnapshot = await getDocs(q);
                const exList: Exercise[] = [];
                querySnapshot.forEach((doc) => {
                    exList.push({ id: doc.id, ...doc.data() } as Exercise);
                });
                exList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                setAvailableExercises(exList);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchExercises();
    }, []);

    const addExercise = (ex: Exercise) => {
        const newEx: TemplateExerciseConfig = {
            exerciseId: ex.id,
            tempId: Math.random().toString(36).substr(2, 9),
            order: getNextOrder(selectedExercises.length),
            sets: 3,
            targetReps: "8-12",
            tempo: "3010",
            rest: 60,
            notes: ""
        };
        setSelectedExercises([...selectedExercises, newEx]);
        setIsExerciseModalOpen(false);
    };

    const getNextOrder = (idx: number) => {
        return String.fromCharCode(65 + idx); // A, B, C... simplified default
    };

    const removeExercise = (tempId: string) => {
        setSelectedExercises(selectedExercises.filter(e => e.tempId !== tempId));
    };

    const updateExercise = (tempId: string, field: keyof TemplateExerciseConfig, value: any) => {
        setSelectedExercises(prev => prev.map(e =>
            e.tempId === tempId ? { ...e, [field]: value } : e
        ));
    };

    const handleSave = async () => {
        const firestore = db;
        if (!templateName) {
            alert("Please enter a template name.");
            return;
        }
        if (selectedExercises.length === 0 || !firestore) {
            alert("Please add at least one exercise.");
            return;
        }

        setSaving(true);
        try {
            // 1. Create Template
            const templateRef = await addDoc(collection(firestore, 'workout_templates'), {
                name: templateName,
                description: description,
                created_at: new Date().toISOString()
            });

            // 2. Create Template Items (Batch)
            const batch = writeBatch(firestore);
            selectedExercises.forEach(ex => {
                const itemRef = doc(collection(firestore, 'workout_template_exercises'));
                batch.set(itemRef, {
                    template_id: templateRef.id,
                    exercise_id: ex.exerciseId,
                    exercise_order: ex.order,
                    target_sets: ex.sets,
                    target_reps: ex.targetReps,
                    tempo: ex.tempo,
                    rest_time: ex.rest,
                    notes: ex.notes
                });
            });

            await batch.commit();

            // Success
            router.push('/admin/templates');

        } catch (err: any) {
            console.error(err);
            alert("Error saving template: " + err.message);
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
                        <Link href="/admin/templates" className="mr-4 text-gray-500 hover:text-primary">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">New Template</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save Template"}
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

                {/* Meta */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary text-lg font-bold"
                                placeholder="e.g. Full Body A"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full border border-gray-300 rounded p-2 focus:ring-primary focus:border-primary"
                                placeholder="Describe the goal of this routine..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                {/* Exercises */}
                <div className="space-y-4">
                    {selectedExercises.map((ex, idx) => {
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
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Order: {ex.order}</span>
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
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded text-sm">
                                    <div className="col-span-1">
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Order</label>
                                        <input
                                            value={ex.order}
                                            onChange={(e) => updateExercise(ex.tempId, 'order', e.target.value)}
                                            className="w-full border rounded p-1"
                                            placeholder="A1"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Sets</label>
                                        <input
                                            type="number"
                                            value={ex.sets}
                                            onChange={(e) => updateExercise(ex.tempId, 'sets', parseInt(e.target.value) || 1)}
                                            className="w-full border rounded p-1"
                                            min="1"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Reps</label>
                                        <input
                                            value={ex.targetReps}
                                            onChange={(e) => updateExercise(ex.tempId, 'targetReps', e.target.value)}
                                            className="w-full border rounded p-1"
                                            placeholder="8-12"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Rest (s)</label>
                                        <input
                                            type="number"
                                            value={ex.rest}
                                            onChange={(e) => updateExercise(ex.tempId, 'rest', parseInt(e.target.value) || 60)}
                                            className="w-full border rounded p-1"
                                            placeholder="60"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-1">
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Tempo</label>
                                        <input
                                            value={ex.tempo}
                                            onChange={(e) => updateExercise(ex.tempId, 'tempo', e.target.value)}
                                            className="w-full border rounded p-1"
                                            placeholder="3010"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={() => setIsExerciseModalOpen(true)}
                        className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-primary hover:border-primary hover:bg-blue-50 transition-all flex flex-col items-center justify-center font-medium"
                    >
                        <Plus className="w-8 h-8 mb-2" />
                        Add Exercise
                    </button>
                </div>

            </div>

            {/* Exercise Selector Modal (Reused Logic) */}
            {isExerciseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg">Select Exercise</h3>
                            <button onClick={() => setIsExerciseModalOpen(false)} className="text-gray-500 hover:text-black text-2xl font-light">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-4">
                            {loading ? <p className="text-center py-10">Loading...</p> : (
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
        </div>
    );
}
