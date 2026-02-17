"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Play, Calendar, Clock, Loader2, Trash2, Shield, FileText, Users, Copy } from "lucide-react";
import { db } from "@/lib/firebase"; // Firebase import
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, addDoc, writeBatch, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { MessageSquare } from "lucide-react";

type DbWorkout = {
    id: string;
    name: string;
    date: string;
    created_at: string;
    user_id: string;
    coach_feedback?: string;
    is_feedback_read?: boolean;
};

export default function DashboardPage() {
    const { user, role, loading: authLoading } = useAuth();
    const [workouts, setWorkouts] = useState<DbWorkout[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [unreadFeedback, setUnreadFeedback] = useState<DbWorkout | null>(null);

    // Duplicate State
    const [duplicateContext, setDuplicateContext] = useState<DbWorkout | null>(null);
    const [copyDate, setCopyDate] = useState(new Date().toISOString().split('T')[0]);
    const [copying, setCopying] = useState(false);

    const router = useRouter();

    useEffect(() => {
        if (authLoading) return; // Wait for auth check
        if (!user) {
            router.push("/login");
            return;
        }

        async function fetchHistory() {
            setLoading(true);

            try {
                // Determine if we need to order by date desc
                // Firestore requires an index for compound queries (where + orderBy).
                // Without index, this might fail initially. 
                // We'll try user_id filter + client sort or create index link.

                const workoutsRef = collection(db, 'workouts');
                const q = query(
                    workoutsRef,
                    where('user_id', '==', user!.uid),
                    orderBy('date', 'desc')
                );

                const querySnapshot = await getDocs(q);

                const fetchedWorkouts: DbWorkout[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    fetchedWorkouts.push({
                        id: doc.id,
                        name: data.name,
                        date: data.date,
                        created_at: data.created_at || new Date().toISOString(),
                        user_id: data.user_id,
                        coach_feedback: data.coach_feedback,
                        is_feedback_read: data.is_feedback_read
                    });
                });

                setWorkouts(fetchedWorkouts);

                // Check for unread feedback
                const unread = fetchedWorkouts.find((w) => w.coach_feedback && w.is_feedback_read === false);
                if (unread) setUnreadFeedback(unread);

            } catch (error) {
                console.error("Error al cargar historial:", error);
                // Fallback for missing index error
                if (String(error).includes('requires an index')) {
                    console.warn("Falta índice en Firestore. Revisa la consola del navegador para el enlace de creación.");
                }
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [user, role, authLoading, router]);

    const handleDeleteWorkout = async (e: React.MouseEvent, workoutId: string) => {
        e.preventDefault(); // Prevent navigation if nested
        if (!confirm("¿Estás seguro de querer eliminar este entrenamiento? No se puede deshacer de forma inmediata.")) return;

        try {
            await deleteDoc(doc(db, 'workouts', workoutId));
            // Optimistic update
            setWorkouts(prev => prev.filter(w => w.id !== workoutId));
        } catch (error: any) {
            alert("Error al eliminar entrenamiento: " + error.message);
        }
    };

    const handleStartNewWorkout = async () => {
        // Navigate to the new builder page
        router.push("/dashboard/create-workout");
    };

    const handleCloseFeedback = async () => {
        if (!unreadFeedback) return;

        // Optimistic close
        const currentId = unreadFeedback.id;
        setUnreadFeedback(null);

        try {
            const workoutRef = doc(db, 'workouts', currentId);
            await updateDoc(workoutRef, { is_feedback_read: true });
        } catch (error) {
            console.error("Error updating feedback read status", error);
        }
    };

    const handleDuplicateClick = (workout: DbWorkout) => {
        setDuplicateContext(workout);
        setCopyDate(new Date().toISOString().split('T')[0]); // Default to today
    };

    const handleConfirmDuplicate = async () => {
        if (!duplicateContext) return;
        setCopying(true);

        try {
            if (!user) throw new Error("No user found");

            // 1. Fetch Source Workout to get details (like occurrences)
            const sourceDoc = await getDoc(doc(db, 'workouts', duplicateContext.id));
            if (!sourceDoc.exists()) throw new Error("Original workout not found");
            const sourceData = sourceDoc.data();

            // 2. Create New Workout
            const newWorkoutRef = await addDoc(collection(db, 'workouts'), {
                name: sourceData.name || "Workout Copy",
                date: copyDate,
                user_id: user.uid,
                created_at: new Date().toISOString(),
                occurrences: sourceData.occurrences || 1,
                coach_feedback: null,
                is_feedback_read: true
            });

            // 3. Fetch Source Logs
            const q = query(collection(db, 'workout_logs'), where('workout_id', '==', duplicateContext.id));
            const logsSnapshot = await getDocs(q);

            // 4. Batch Insert New Logs
            const batch = writeBatch(db);
            const logsRef = collection(db, 'workout_logs');

            logsSnapshot.forEach((logDoc) => {
                const log = logDoc.data();
                const newLogRef = doc(logsRef);
                batch.set(newLogRef, {
                    workout_id: newWorkoutRef.id, // Link to NEW workout
                    exercise_id: log.exercise_id,
                    set_number: log.set_number,
                    day_number: log.day_number || 1,
                    exercise_order: log.exercise_order,
                    target_reps: log.target_reps,
                    tempo: log.tempo,
                    rest_time: log.rest_time,

                    // Reset Execution Data
                    weight: null,
                    reps: null,
                    completed: false,
                    rpe: null,
                    notes: null,

                    created_at: new Date().toISOString()
                });
            });

            await batch.commit();

            // Success! Redirect to new workout
            router.push(`/workout/${newWorkoutRef.id}`);

        } catch (e: any) {
            console.error("Copy error:", e);
            alert("Error al intentar copiar: " + e.message);
        } finally {
            setCopying(false);
            setDuplicateContext(null);
        }
    };

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-10">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-xl font-bold text-gray-700 mb-4">Verificando sesión...</p>
                <div className="text-sm text-gray-500 max-w-md text-center">
                    <p>Conectando a base de datos...</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 text-primary hover:underline block w-full"
                    >
                        ¿Atascado? Click para recargar
                    </button>
                    <button
                        onClick={() => {
                            window.location.href = '/login';
                        }}
                        className="mt-2 text-red-500 hover:text-red-700 block w-full text-xs"
                    >
                        Cerrar Sesión / Resetear
                    </button>
                </div>
            </div>
        );
    }

    const isAdmin = role === 'admin' || role === 'super_admin';

    return (
        <div className="py-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tu Registro de Entrenamiento</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Sigue tu progreso y consistencia
                    </p>
                </div>

                {/* RBAC: Only Admin can create/assign workouts */}
                {isAdmin && (
                    <button
                        onClick={handleStartNewWorkout}
                        disabled={creating}
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-3 px-6 rounded shadow-lg transition-transform transform hover:-translate-y-1 flex items-center"
                    >
                        {creating ? (
                            <span className="animate-spin mr-2">⏳</span>
                        ) : (
                            <Plus className="w-5 h-5 mr-2" />
                        )}
                        {creating ? "Creando..." : "Nuevo Entrenamiento"}
                    </button>
                )}
            </div>

            {/* Admin Shortcuts */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <Link href="/admin" className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-center hover:bg-purple-100 transition-colors">
                        <div className="bg-purple-200 p-2 rounded-full mr-3 text-purple-800">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-purple-900">Panel Admin</div>
                            <div className="text-xs text-purple-700">Ir al panel principal</div>
                        </div>
                    </Link>
                    <Link href="/admin/exercises" className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center hover:bg-blue-100 transition-colors">
                        <div className="bg-blue-200 p-2 rounded-full mr-3 text-blue-800">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-blue-900">Biblioteca Ejercicios</div>
                            <div className="text-xs text-blue-700">Gestionar ejercicios y videos</div>
                        </div>
                    </Link>
                    <Link href="/admin/users" className="bg-green-50 p-4 rounded-lg border border-green-100 flex items-center hover:bg-green-100 transition-colors">
                        <div className="bg-green-200 p-2 rounded-full mr-3 text-green-800">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-green-900">Clientes</div>
                            <div className="text-xs text-green-700">Gestionar atletas</div>
                        </div>
                    </Link>
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white p-6 rounded shadow-sm border border-gray-200 animate-pulse h-24"></div>
                    ))}
                </div>
            ) : workouts.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-surface rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No se encontraron entrenamientos</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        {isAdmin ? "Comienza una nueva sesión para probar el seguimiento." : "Aún no tienes entrenamientos asignados."}
                    </p>
                    {isAdmin && (
                        <button
                            onClick={handleStartNewWorkout}
                            className="text-primary font-bold hover:underline"
                        >
                            class
                            Created your first workout
                            Crear tu primer entrenamiento
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {workouts.map((session) => (
                        <div key={session.id} className="bg-white dark:bg-surface p-6 rounded shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between group">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-2 rounded-full">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                                        {session.name || "Entrenamiento Sin Título"}
                                    </h3>
                                    {isAdmin && (
                                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded">
                                            {session.user_id.slice(0, 8)}...
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4 pl-12">
                                    <span className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                        {new Date(session.date).toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>



                            <div className="mt-4 md:mt-0 flex items-center md:pl-8 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 space-x-2">
                                <Link
                                    href={`/workout/${session.id}`}
                                    className="bg-gray-50 dark:bg-gray-800 hover:bg-primary hover:text-white dark:hover:bg-primary text-gray-700 dark:text-gray-200 font-bold py-2 px-6 rounded transition-colors flex items-center justify-center flex-1"
                                >
                                    Ver Sesión <Play className="w-4 h-4 ml-2 fill-current" />
                                </Link>

                                <button
                                    onClick={() => handleDuplicateClick(session)}
                                    className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 p-2 rounded transition-colors"
                                    title="Repetir este entrenamiento"
                                >
                                    <Copy className="w-5 h-5" />
                                </button>

                                {isAdmin && (
                                    <button
                                        onClick={(e) => handleDeleteWorkout(e, session.id)}
                                        className="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 p-2 rounded transition-colors"
                                        title="Eliminar Entrenamiento"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Feedback Modal */}
            {unreadFeedback && (
                <Modal
                    isOpen={!!unreadFeedback}
                    onClose={handleCloseFeedback}
                    title="¡Nuevo Feedback del Coach!"
                >
                    <div className="text-center">
                        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <MessageSquare className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">
                            Feedback sobre "{unreadFeedback.name}"
                        </h3>
                        <p className="text-gray-500 text-sm mb-6">
                            {new Date(unreadFeedback.date).toLocaleDateString()}
                        </p>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-left mb-6 max-h-60 overflow-y-auto">
                            <p className="whitespace-pre-wrap text-gray-800">{unreadFeedback.coach_feedback}</p>
                        </div>

                        <button
                            onClick={handleCloseFeedback}
                            className="w-full py-3 bg-primary hover:bg-blue-900 text-white font-bold rounded-lg transition-colors"
                        >
                            ¡Entendido!
                        </button>
                    </div>
                </Modal>
            )}

            {/* Duplicate Modal */}
            {duplicateContext && (
                <Modal
                    isOpen={!!duplicateContext}
                    onClose={() => setDuplicateContext(null)}
                    title="Repetir Entrenamiento"
                >
                    <div className="space-y-4">
                        <p className="text-gray-600">
                            Estás a punto de crear una copia de <strong>"{duplicateContext.name}"</strong> para realizarla de nuevo.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha de realización
                            </label>
                            <input
                                type="date"
                                value={copyDate}
                                onChange={(e) => setCopyDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setDuplicateContext(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium"
                                disabled={copying}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDuplicate}
                                disabled={copying}
                                className="px-6 py-2 bg-primary hover:bg-blue-900 text-white rounded-md font-bold flex items-center shadow-lg"
                            >
                                {copying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                                {copying ? "Copiando..." : "Crear Copia"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
