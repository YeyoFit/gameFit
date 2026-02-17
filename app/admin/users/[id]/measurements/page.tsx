"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, Calendar } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type Measurement = {
    id: string;
    recorded_at: string;
    weight: number;
    body_fat_percentage: number | null;
    notes: string;
};

type UserProfile = {
    email: string;
};

export default function UserMeasurementsPage() {
    const { role } = useAuth();
    const router = useRouter();
    const params = useParams();
    const userId = params?.id as string;

    const [measurements, setMeasurements] = useState<Measurement[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [weight, setWeight] = useState("");
    const [bodyFat, setBodyFat] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!userId) return;
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);

        try {
            // 1. Fetch User Info (for header)
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                setUserProfile(userDoc.data() as UserProfile);
            }

            // 2. Fetch Measurements
            const q = query(
                collection(db, 'client_measurements'),
                where('user_id', '==', userId),
                orderBy('recorded_at', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const measureData: Measurement[] = [];
            querySnapshot.forEach((doc) => {
                measureData.push({ id: doc.id, ...doc.data() } as Measurement);
            });
            setMeasurements(measureData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMeasurement = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await addDoc(collection(db, 'client_measurements'), {
                user_id: userId,
                recorded_at: date,
                weight: parseFloat(weight),
                body_fat_percentage: bodyFat ? parseFloat(bodyFat) : null,
                notes: notes,
                created_at: new Date().toISOString()
            });

            // Reset form
            setWeight("");
            setBodyFat("");
            setNotes("");
            fetchData();
        } catch (error: any) {
            alert("Error adding measurement: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, 'client_measurements', id));
            fetchData();
        } catch (error: any) {
            alert(error.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="py-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <Link href="/admin/users" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Users</span>
                </Link>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Measurements</h1>
                <p className="text-gray-500">Tracking for: <span className="font-mono bg-yellow-50 px-1">{userProfile?.email || userId}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Form */}
                <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
                    <h3 className="font-bold text-lg mb-4 text-primary">Add New Entry</h3>
                    <form onSubmit={handleAddMeasurement} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Weight (Kg)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={weight}
                                onChange={e => setWeight(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                                placeholder="e.g. 75.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Body Fat %</label>
                            <input
                                type="number"
                                step="0.1"
                                value={bodyFat}
                                onChange={e => setBodyFat(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                                placeholder="e.g. 15.0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full border rounded p-2 text-sm h-20"
                                placeholder="Any observations..."
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-primary hover:bg-blue-900 text-white font-bold py-2 rounded flex items-center justify-center"
                        >
                            {isSubmitting ? "Saving..." : <><Plus className="w-4 h-4 mr-2" /> Record</>}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="md:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fat %</th>
                                    <th className="px-4 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {measurements.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">No measurements recorded yet.</td>
                                    </tr>
                                ) : (
                                    measurements.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <div className="flex items-center">
                                                    <Calendar className="w-3 h-3 mr-2 text-gray-400" />
                                                    {m.recorded_at}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-primary">{m.weight} Kg</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{m.body_fat_percentage ? `${m.body_fat_percentage}%` : '-'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
