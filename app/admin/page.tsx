"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, Search, Activity, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, doc, deleteDoc, writeBatch } from "firebase/firestore";

export default function AdminDashboard() {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();
    const [clients, setClients] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Route protection & Data Fetching
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }

        if (role !== 'admin' && role !== 'super_admin') {
            router.push("/");
            return;
        }

        const fetchData = async () => {
            setLoading(true);

            try {
                // 1. Fetch Clients
                // Note: requires index on 'role' if mixed with other filters, but simple where is fine.
                const qClients = query(collection(db, 'users'), where('role', '==', 'user'));
                const clientsSnap = await getDocs(qClients);
                const clientsData: any[] = [];
                clientsSnap.forEach(doc => clientsData.push({ id: doc.id, ...doc.data() }));
                setClients(clientsData);

                // 2. Fetch Recent Activity
                const qActivity = query(collection(db, 'workouts'), orderBy('created_at', 'desc'), limit(5));
                const activitySnap = await getDocs(qActivity);
                const activityData: any[] = [];
                activitySnap.forEach(doc => activityData.push({ id: doc.id, ...doc.data() }));
                setRecentActivity(activityData);

            } catch (error) {
                console.error("Error al cargar datos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, role, authLoading, router]);

    const handleDeleteWorkout = async (e: React.MouseEvent, workoutId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("¿Seguro que quieres borrar este entrenamiento?")) return;

        try {
            // Batch delete logs and workout
            const batch = writeBatch(db);

            // 1. Get logs
            const qLogs = query(collection(db, 'workout_logs'), where('workout_id', '==', workoutId));
            const logsSnap = await getDocs(qLogs);
            logsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 2. Delete workout
            const workoutRef = doc(db, 'workouts', workoutId);
            batch.delete(workoutRef);

            await batch.commit();

            alert("Entrenamiento borrado");
            // Optimistic update
            setRecentActivity(prev => prev.filter(w => w.id !== workoutId));

        } catch (err: any) {
            console.error("Error deleting:", err);
            alert("Error al borrar: " + err.message);
        }
    };

    if (authLoading || loading) return <div className="p-10">Cargando panel...</div>;
    if (!user || (role !== 'admin' && role !== 'super_admin')) return null;

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-primary mb-2">Panel del Entrenador y Actividad</h1>
                    <p className="text-muted">Gestiona tus atletas, programación y actividad en vivo.</p>
                </div>
                <div className="flex items-center gap-4">
                    {role === 'super_admin' && (
                        <Link href="/admin/users" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow">
                            Gestionar Usuarios
                        </Link>
                    )}
                    <div className="bg-primary text-white px-4 py-2 rounded-md font-bold text-sm">
                        {user.email}
                    </div>
                </div>
            </div>

            {/* Live Feed Section */}
            <div className="mb-10">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-green-500" />
                    Actividad Reciente
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentActivity.map(workout => {
                        const client = clients.find(c => c.id === workout.user_id);
                        // Fallback name if client not found in the 'user' list (e.g. admin's own workout)
                        const clientName = client ? (client.email || client.full_name || client.id) :
                            (workout.user_id === user.uid ? 'Tú (Admin)' : 'Usuario Desconocido');

                        return (
                            <div key={workout.id} className="bg-white dark:bg-surface p-4 rounded-lg shadow-sm border-l-4 border-green-500 flex flex-col relative group">
                                <span className="text-xs text-gray-400 font-mono mb-1">{new Date(workout.created_at).toLocaleString()}</span>
                                <span className="font-bold text-gray-900 dark:text-gray-100">{clientName}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300">completó <strong>{workout.name}</strong></span>
                                <div className="mt-2 flex items-center justify-between">
                                    <Link href={`/workout/${workout.id}`} className="text-xs text-primary font-bold hover:underline">
                                        Ver Detalles &rarr;
                                    </Link>
                                    <button
                                        onClick={(e) => handleDeleteWorkout(e, workout.id)}
                                        className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Borrar entrenamiento"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {recentActivity.length === 0 && (
                        <div className="col-span-3 text-center text-gray-400 italic">No hay actividad reciente</div>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white dark:bg-surface p-6 rounded-lg shadow-sm border border-border">
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full text-primary">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-muted text-sm font-bold uppercase">Clientes Activos</p>
                            <p className="text-2xl font-bold text-primary">{clients.length}</p>
                        </div>
                    </div>
                </div>

                {/* Exercise Library Card */}
                <Link href="/admin/exercises" className="bg-white dark:bg-surface p-6 rounded-lg shadow-sm border border-border hover:border-primary transition-colors cursor-pointer group">
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-muted text-sm font-bold uppercase group-hover:text-primary transition-colors">Biblioteca de Ejercicios</p>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gestionar Ejercicios</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Client List */}
            <div className="bg-white dark:bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                    <h3 className="text-lg font-bold text-primary">Clientes</h3>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                        <input
                            placeholder="Buscar cliente..."
                            className="pl-9 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-surface divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">Cargando clientes...</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
                        ) : (
                            clients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                                                {client.email?.[0].toUpperCase()}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{client.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Activo
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <Link href={`/dashboard?userId=${client.id}`} className="text-primary hover:text-blue-400 font-bold flex items-center justify-end">
                                            <Activity className="w-4 h-4 mr-1" /> Ver Dashboard
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
