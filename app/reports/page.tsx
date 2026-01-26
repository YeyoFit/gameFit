"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Loader2, TrendingUp, BarChart2 } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from "recharts";

type ChartData = {
    name: string;
    [key: string]: string | number;
};

import { useSearchParams } from "next/navigation";

function ReportsContent() {
    const searchParams = useSearchParams();
    const targetUserId = searchParams.get("userId");
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);

    // Chart Data
    const [volumeData, setVolumeData] = useState<ChartData[]>([]);
    const [strengthData, setStrengthData] = useState<ChartData[]>([]);
    const [bodyParts, setBodyParts] = useState<string[]>([]);
    const [selectedExercise, setSelectedExercise] = useState("Bench Press");
    const [availableExercises, setAvailableExercises] = useState<string[]>([]);

    useEffect(() => {
        if (!user || authLoading) return;
        fetchData();
    }, [user, authLoading]);

    const fetchData = async () => {
        setLoading(true);

        // Determine ID to fetch
        const idToFetch = (user?.role === 'admin' || user?.role === 'super_admin') && targetUserId
            ? targetUserId
            : user!.id;

        // Fetch all logs for this user
        // We need: date (from workouts), body_part (from exercises), weight, reps
        const { data, error } = await supabase
            .from('workout_logs')
            .select(`
                weight,
                reps,
                workouts!inner (
                    date,
                    user_id
                ),
                exercises (
                    name,
                    body_part
                )
            `)
            .eq('workouts.user_id', idToFetch)
            .order('created_at', { ascending: true }); // Process chronologically

        if (error) {
            console.error("Error fetching logs:", error);
            setLoading(false);
            return;
        }

        if (!data) return;

        // Process Volume Data (Weekly Volume per Body Part)
        type VolumeEntry = { name: string;[key: string]: string | number; };
        const volumeMap = new Map<string, VolumeEntry>();
        const allExampleExercises = new Set<string>();
        const allBodyParts = new Set<string>();

        data.forEach((log: any) => {
            const dateStr = log.workouts?.date;
            if (!dateStr) return;

            // Group by Week (Simple: Start of week)
            const dateObj = new Date(dateStr);
            const monday = new Date(dateObj);
            monday.setDate(dateObj.getDate() - dateObj.getDay() + 1); // Adjust to Monday
            const weekKey = monday.toISOString().split('T')[0];

            const part = log.exercises?.body_part || 'Other';
            const name = log.exercises?.name;
            const vol = (log.weight || 0) * (log.reps || 0);

            if (name) allExampleExercises.add(name);
            allBodyParts.add(part);

            if (!volumeMap.has(weekKey)) {
                volumeMap.set(weekKey, { name: weekKey });
            }

            const entry = volumeMap.get(weekKey)!;
            const currentVal = (typeof entry[part] === 'number') ? entry[part] as number : 0;
            entry[part] = currentVal + vol;
        });

        const vData: ChartData[] = Array.from(volumeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setVolumeData(vData);
        setBodyParts(Array.from(allBodyParts));
        setAvailableExercises(Array.from(allExampleExercises));

        // Initial Strength Data Processing (will rely on selectedExercise effect mostly, but we preload valid list)
        // We'll process strength data specifically for the selected exercise in a separate effect or function 
        // but since we have all data here, let's just store the raw data for re-filtering.
        // For simplicity now, let's just re-run the "process strength" logic when selection changes, 
        // but we need the raw data available. I'll store raw data in a ref or state if needed, 
        // but re-fetching is safer for now or just filter `data` again? 
        // Actually, let's map `data` to a state `rawLogs` so we don't query DB again.

        setRawLogs(data); // Need to define this state
        setLoading(false);
    };

    const [rawLogs, setRawLogs] = useState<any[]>([]);

    useEffect(() => {
        if (rawLogs.length === 0 || !selectedExercise) return;

        // Process Strength (1RM) for Selected Exercise
        const strengthMap = new Map<string, number>();

        rawLogs.forEach((log: any) => {
            if (log.exercises?.name !== selectedExercise) return;
            const date = log.workouts?.date;
            if (!date) return;

            const w = log.weight || 0;
            const r = log.reps || 0;
            if (w === 0 || r === 0) return;

            // E1RM Formula: w * (1 + r/30)
            const e1rm = w * (1 + r / 30);

            // Keep max 1RM per day
            if (!strengthMap.has(date) || strengthMap.get(date)! < e1rm) {
                strengthMap.set(date, e1rm);
            }
        });

        const sData = Array.from(strengthMap.entries())
            .map(([date, val]) => ({ name: date, value: Math.round(val) }))
            .sort((a, b) => a.name.localeCompare(b.name));

        setStrengthData(sData);

    }, [selectedExercise, rawLogs]);

    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F"];

    if (authLoading || loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
    );

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Performance Analytics</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Volume Chart */}
                {/* Volume Chart */}
                <div className="bg-white dark:bg-surface p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center mb-6">
                        <BarChart2 className="w-5 h-5 text-primary mr-2" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Weekly Volume (kg)</h2>
                    </div>

                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={volumeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                                <YAxis fontSize={12} />
                                <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString()} />
                                <Legend />
                                {bodyParts.map((part, idx) => (
                                    <Bar key={part} dataKey={part} stackId="a" fill={colors[idx % colors.length]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Strength Chart */}
                <div className="bg-white dark:bg-surface p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                            <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Strength Progress (Est. 1RM)</h2>
                        </div>
                        <select
                            value={selectedExercise}
                            onChange={e => setSelectedExercise(e.target.value)}
                            className="text-sm border-gray-300 border rounded-md shadow-sm p-1"
                        >
                            {availableExercises.sort().map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-[300px]">
                        {strengthData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={strengthData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                                    <YAxis domain={['auto', 'auto']} fontSize={12} />
                                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString()} />
                                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                No data for this exercise yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Total Workouts</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {new Set(rawLogs.map(l => l.workouts?.date)).size}
                    </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-100 dark:border-purple-900">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase">Heaviest Lift</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {Math.max(...rawLogs.map(l => l.weight || 0), 0)} kg
                    </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-100 dark:border-green-900">
                    <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Total Reps</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {rawLogs.reduce((acc, l) => acc + (l.reps || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-100 dark:border-orange-900">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase">Total Tonnage</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {(rawLogs.reduce((acc, l) => acc + ((l.reps || 0) * (l.weight || 0)), 0) / 1000).toFixed(1)}k
                    </p>
                </div>
            </div>
        </div>
    );

}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>}>
            <ReportsContent />
        </Suspense>
    );
}
