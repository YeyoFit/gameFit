"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, addDoc, writeBatch, doc } from "firebase/firestore";
import { Brain, Search, Send, Plus, Loader2, CheckCircle2, AlertCircle, Save, User, Sparkles, BookOpen, Quote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

type Exercise = {
    exerciseId: string | null;
    name: string;
    isNew: boolean;
    body_part: string;
    sets: number;
    reps: string;
    tempo: string;
    rest: string;
    notes: string;
    technique_cues: string[];
};

type AIResponse = {
    rationale: string;
    workout: Exercise[];
};

export default function AICoachPage() {
    const router = useRouter();
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [goal, setGoal] = useState("");
    const [loading, setLoading] = useState(false);
    const [aiResult, setAiResult] = useState<AIResponse | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/ai-coach");
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setClients(data.clients || []);
            } catch (err: any) {
                console.error("Error fetching data:", err);
                alert("Error al cargar atletas: " + err.message);
            }
        };
        fetchData();
    }, []);

    const handleGenerate = async () => {
        if (!selectedClientId || !goal) return;
        setLoading(true);
        setAiResult(null);

        try {
            const res = await fetch("/api/ai-coach", {
                method: "POST",
                body: JSON.stringify({ clientId: selectedClientId, goal }),
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAiResult(data);
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsWorkout = async () => {
        if (!aiResult || !db) return;
        setSaving(true);
        try {
            const batch = writeBatch(db);
            const userEmail = clients.find(c => c.id === selectedClientId)?.email || "Client";

            // 1. Create Workout
            const workoutRef = await addDoc(collection(db, 'workouts'), {
                user_id: selectedClientId,
                name: `IA: ${goal.slice(0, 20)}...`,
                date: new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                is_ai_generated: true,
                ai_rationale: aiResult.rationale
            });

            // 2. Handle Exercises (including new ones)
            const logsRef = collection(db, 'workout_logs');
            for (const ex of aiResult.workout) {
                let exerciseId = ex.exerciseId;

                // Create new exercise if it doesn't exist
                if (ex.isNew || !exerciseId) {
                    const newExRef = await addDoc(collection(db, 'exercises'), {
                        name: ex.name,
                        body_part: ex.body_part,
                        technique_cues: ex.technique_cues,
                        created_at: new Date().toISOString(),
                        is_ai_suggested: true
                    });
                    exerciseId = newExRef.id;
                }

                // Create logs/sets
                for (let i = 1; i <= ex.sets; i++) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        workout_id: workoutRef.id,
                        exercise_id: exerciseId,
                        set_number: i,
                        target_reps: ex.reps,
                        tempo: ex.tempo,
                        rest_time: ex.rest,
                        notes: `${ex.notes}\n\nCUANDO: ${ex.technique_cues.join(", ")}`,
                        completed: false,
                        created_at: new Date().toISOString()
                    });
                }
            }

            await batch.commit();
            alert("Entrenamiento generado y asignado!");
            router.push(`/admin/users/${selectedClientId}`);
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-900">
            {/* Header / Hero Section */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-900 py-16 px-4 sm:px-6 lg:px-8 shadow-xl text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 opacity-10 animate-pulse">
                    <Brain size={400} />
                </div>
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                            <Sparkles className="text-yellow-300 w-8 h-8" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                            Coach Científico IA
                        </h1>
                    </div>
                    <p className="mt-4 text-xl text-blue-100 max-w-3xl">
                        Programa entrenamientos de élite basados en evidencia científica, adaptados al historial específico de cada uno de tus atletas.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 overflow-visible">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Input Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-blue-50 dark:border-slate-700 transform transition-all hover:scale-[1.01]">
                            <div className="flex items-center space-x-2 mb-6">
                                <BookOpen className="text-blue-600 w-5 h-5" />
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">Configuración</h2>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center">
                                        <User className="w-4 h-4 mr-1 text-blue-500" /> Atleta
                                    </label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    >
                                        <option value="">Selecciona un cliente...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.email}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center">
                                        <Brain className="w-4 h-4 mr-1 text-purple-500" /> Objetivo de la IA
                                    </label>
                                    <textarea
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                        placeholder="Ej: Preparación técnica para maratón, enfoque en estabilidad de tobillo y core..."
                                        rows={4}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                    />
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={loading || !selectedClientId || !goal}
                                    className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin" /> <span>Analizando evidencia...</span></>
                                    ) : (
                                        <><Send className="w-5 h-5" /> <span>Generar Plan Maestro</span></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Result Panel */}
                    <div className="lg:col-span-8">
                        {!aiResult && !loading && (
                            <div className="bg-white dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl h-96 flex flex-col items-center justify-center text-slate-400 group">
                                <Brain className="w-20 h-20 mb-4 opacity-20 group-hover:opacity-40 transition-opacity" />
                                <p className="text-lg font-medium opacity-60">Define el objetivo para comenzar la consulta</p>
                            </div>
                        )}

                        {loading && (
                            <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl shadow-xl flex flex-col items-center justify-center space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                    <Brain className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600 w-8 h-8" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-xl font-bold text-slate-800 dark:text-white">Procesando historial del atleta</p>
                                    <p className="text-slate-500 text-sm italic">"Cruzando datos de last 5 sessions con literatura técnica..."</p>
                                </div>
                            </div>
                        )}

                        {aiResult && (
                            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6">
                                {/* Rationale Card */}
                                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border-l-[6px] border-indigo-500 relative overflow-hidden">
                                    <Quote className="absolute -top-4 -right-4 w-24 h-24 text-indigo-50 opacity-10 dark:text-indigo-400/10" />
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                                        <Sparkles className="w-5 h-5 mr-2 text-yellow-500" /> Razón Científica del Programa
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic text-lg leading-relaxed">
                                        "{aiResult.rationale}"
                                    </p>
                                </div>

                                {/* Workout Table */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                                    <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/40 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <h4 className="font-bold text-indigo-900 dark:text-indigo-200">Ejercicios Prescritos</h4>
                                        <div className="flex items-center space-x-2 text-xs font-bold uppercase text-slate-500">
                                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div> Biblioteca</span>
                                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-orange-500 mr-1"></div> Nuevo</span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-700">
                                                    <th className="px-6 py-4">Ejercicio</th>
                                                    <th className="px-6 py-4">Volumen</th>
                                                    <th className="px-6 py-4">Tempo/Descanso</th>
                                                    <th className="px-6 py-4">Prescripción IA</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {aiResult.workout.map((ex, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={clsx(
                                                                    "p-2 rounded-lg shrink-0",
                                                                    ex.isNew ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
                                                                )}>
                                                                    {ex.isNew ? <Plus size={18}/> : <CheckCircle2 size={18}/>}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-white leading-tight">{ex.name}</p>
                                                                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">{ex.body_part}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="text-sm">
                                                                <span className="font-bold text-slate-800 dark:text-white">{ex.sets}</span>
                                                                <span className="text-slate-400 mx-1">x</span>
                                                                <span className="font-bold text-slate-800 dark:text-white">{ex.reps}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="space-y-1">
                                                                <div className="text-xs flex items-center text-slate-500">
                                                                    <span className="w-3.5 h-3.5 mr-1.5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[8px] font-bold">T</span>
                                                                    {ex.tempo}
                                                                </div>
                                                                <div className="text-xs flex items-center text-slate-500">
                                                                    <span className="w-3.5 h-3.5 mr-1.5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[8px] font-bold">R</span>
                                                                    {ex.rest}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="max-w-xs space-y-2">
                                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium line-clamp-2">{ex.notes}</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {ex.technique_cues.map((cue, i) => (
                                                                        <span key={i} className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/50">
                                                                            {cue}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="p-6 bg-slate-50 dark:bg-slate-900 flex justify-between items-center border-t border-slate-100 dark:border-slate-700">
                                        {aiResult.workout.some(e => e.isNew) && (
                                            <div className="flex items-center text-orange-600 text-sm font-bold animate-pulse">
                                                <AlertCircle className="w-4 h-4 mr-2" />
                                                Se crearán nuevos ejercicios al aprobar
                                            </div>
                                        )}
                                        <button
                                            onClick={handleSaveAsWorkout}
                                            disabled={saving}
                                            className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                            {saving ? "Guardando..." : "Autorizar y Aplicar Plan"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
