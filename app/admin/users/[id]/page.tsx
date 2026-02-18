"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Plus, Calendar, Activity, TrendingUp, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { ClientReports } from "@/components/ClientReports";

type DbWorkout = {
    id: string;
    name: string;
    date: string;
    created_at: string;
};

type Profile = {
    email: string;
    role: string;
};

export default function ClientDashboardPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.id as string;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [workouts, setWorkouts] = useState<DbWorkout[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workouts' | 'reports'>('workouts');

    useEffect(() => {
        if (!userId) return;
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        const firestore = db;
        if (!firestore) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            // 1. Fetch Profile
            const userDocRef = doc(firestore, 'users', userId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                setProfile(userSnap.data() as Profile);
            }

            // 2. Fetch Workouts
            const qWorkouts = query(
                collection(firestore, 'workouts'),
                where('user_id', '==', userId),
                orderBy('date', 'desc')
            );
            const wSnap = await getDocs(qWorkouts);
            const wData: DbWorkout[] = [];
            wSnap.forEach(doc => {
                const data = doc.data();
                wData.push({
                    id: doc.id,
                    name: data.name,
                    date: data.date,
                    created_at: data.created_at
                });
            });
            setWorkouts(wData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorkout = async (workoutId: string) => {
        if (!confirm("Are you sure you want to delete this workout? This cannot be undone.")) return;
        const firestore = db;
        if (!firestore) return;

        try {
            // Batch delete logs and workout
            const batch = writeBatch(firestore);

            // Get logs
            const qLogs = query(collection(firestore, 'workout_logs'), where('workout_id', '==', workoutId));
            const logsSnap = await getDocs(qLogs);
            logsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete workout
            const workoutRef = doc(firestore, 'workouts', workoutId);
            batch.delete(workoutRef);

            await batch.commit();

            // Refresh list
            fetchData();
        } catch (error: any) {
            alert("Error deleting workout: " + error.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading client data...</div>;

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex items-center mb-6">
                <Link href="/admin/users" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Clients</span>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">{profile?.email || 'Unknown Client'}</h1>
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs uppercase font-bold">{profile?.role}</span>
                        <span>ID: {userId.slice(0, 8)}...</span>
                    </div>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-3">
                    <Link
                        href={`/admin/users/${userId}/measurements`}
                        className="flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Activity className="w-4 h-4 mr-2 text-green-600" />
                        Measurements
                    </Link>
                    {/* Note: Create workout needs to handle assigning to specific user. 
                        Currently it assigns to auth user. We might need to update CreateWorkout to take a query param ?userId=... 
                    */}
                    <Link
                        href={`/dashboard/create-workout?userId=${userId}`}
                        className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-900"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Assign Workout
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-8">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('workouts')}
                        className={`${activeTab === 'workouts'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                    >
                        <Calendar className="w-4 h-4 mr-2" />
                        Workouts
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`${activeTab === 'reports'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Reports & Progress
                    </button>
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'workouts' ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                        {workouts.length === 0 ? (
                            <li className="p-8 text-center text-gray-500">No workouts assigned yet.</li>
                        ) : (
                            workouts.map((workout) => (
                                <li key={workout.id} className="hover:bg-gray-50">
                                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                                        <Link href={`/workout/${workout.id}`} className="flex-1 flex items-center cursor-pointer group">
                                            <Calendar className="flex-shrink-0 mr-3 h-5 w-5 text-gray-400 group-hover:text-primary" />
                                            <div>
                                                <p className="text-sm font-medium text-primary truncate">{workout.name}</p>
                                                <p className="text-sm text-gray-500">{workout.date}</p>
                                            </div>
                                        </Link>
                                        <div className="flex items-center space-x-4">
                                            <Link href={`/dashboard/edit-workout/${workout.id}`} className="flex items-center text-sm text-gray-500 hover:text-primary">
                                                <span className="mr-1 hidden sm:inline">Edit</span>
                                                <Edit3 className="h-4 w-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteWorkout(workout.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors tooltip"
                                                title="Delete Workout"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            ) : (
                <ClientReports userId={userId} />
            )
            }
        </div >
    );
}
