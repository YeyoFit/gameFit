"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ReportData = {
    date: string;
    weight: number;
    bodyFat: number;
    leanMass: number;
    fatMass: number;
};

type ClientReportsProps = {
    userId: string;
    userName?: string;
};

export function ClientReports({ userId, userName }: ClientReportsProps) {
    const [data, setData] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'client_measurements'),
                    where('user_id', '==', userId),
                    orderBy('recorded_at', 'asc')
                );

                const querySnapshot = await getDocs(q);
                const measurements: any[] = [];
                querySnapshot.forEach(doc => measurements.push(doc.data()));

                if (measurements.length > 0) {
                    const processed = measurements.map(m => {
                        const bf = m.body_fat_percentage || 0;
                        const fatMass = (m.weight * bf) / 100;
                        const leanMass = m.weight - fatMass;
                        return {
                            date: m.recorded_at,
                            weight: m.weight,
                            bodyFat: bf,
                            leanMass: parseFloat(leanMass.toFixed(2)),
                            fatMass: parseFloat(fatMass.toFixed(2))
                        };
                    });
                    setData(processed);
                }
            } catch (error) {
                console.error("Error fetching measurements:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    if (loading) {
        return <div className="p-10 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
    }

    return (
        <div>
            <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Progress Overview</h3>
                {userName && <p className="text-gray-500">Charts for {userName}</p>}
            </div>

            {data.length === 0 ? (
                <div className="bg-white p-8 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                    No measurement data available yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Chart 1: Body Fat % */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-primary mb-4">Body Fat %</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickFormatter={(value) => value.substring(5)} />
                                    <YAxis stroke="#6b7280" fontSize={12} domain={[0, 'dataMax + 5']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '4px' }}
                                        itemStyle={{ color: '#1e3a8a', fontWeight: 'bold' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="bodyFat" stroke="#1e3a8a" strokeWidth={3} activeDot={{ r: 8 }} name="Body Fat %" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Lean Mass vs Fat Mass */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-primary mb-4">Body Composition (Kg)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickFormatter={(value) => value.substring(5)} />
                                    <YAxis stroke="#6b7280" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '4px' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="leanMass" stroke="#10b981" strokeWidth={2} name="Lean Mass (Kg)" />
                                    <Line type="monotone" dataKey="fatMass" stroke="#ef4444" strokeWidth={2} name="Fat Mass (Kg)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Data Table */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-bold text-primary">History Data</h3>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Body Fat %</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lean Mass (Kg)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fat Mass (Kg)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.slice().reverse().map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">{row.bodyFat}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.leanMass}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.fatMass}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
}
