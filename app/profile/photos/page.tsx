"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Plus, Calendar, Trash2, ArrowLeft, Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";

type PhotoEntry = {
    id: string;
    date: string;
    front_url?: string;
    back_url?: string;
    side_url?: string;
    weight?: number;
    notes?: string;
};

export default function ProgressPhotosPage() {
    const { user, loading: authLoading } = useAuth();
    const [entries, setEntries] = useState<PhotoEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [frontUrl, setFrontUrl] = useState("");
    const [backUrl, setBackUrl] = useState("");
    const [sideUrl, setSideUrl] = useState("");
    const [weight, setWeight] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (authLoading || !user) return;
        fetchPhotos();
    }, [user, authLoading]);

    const fetchPhotos = async () => {
        const firestore = db;
        if (!firestore) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(
                collection(firestore, 'client_photos'),
                where('user_id', '==', user!.uid),
                orderBy('date', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const photos: PhotoEntry[] = [];
            querySnapshot.forEach((doc) => {
                photos.push({ id: doc.id, ...doc.data() } as PhotoEntry);
            });
            setEntries(photos);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const firestore = db;
        if (!firestore || !user) return;
        setSaving(true);

        try {
            await addDoc(collection(firestore, 'client_photos'), {
                user_id: user!.uid,
                date,
                front_url: frontUrl,
                back_url: backUrl,
                side_url: sideUrl,
                weight: weight ? parseFloat(weight) : null,
                notes,
                created_at: new Date().toISOString()
            });

            setIsModalOpen(false);
            resetForm();
            fetchPhotos();
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        const firestore = db;
        if (!firestore) return;
        if (!confirm("Delete this entry?")) return;
        try {
            await deleteDoc(doc(firestore, 'client_photos', id));
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (error: any) {
            alert(error.message);
        }
    };

    const resetForm = () => {
        setFrontUrl("");
        setBackUrl("");
        setSideUrl("");
        setWeight("");
        setNotes("");
        setDate(new Date().toISOString().split('T')[0]);
    };

    if (authLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <Link href="/profile" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Profile</span>
                </Link>
            </div>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Progress Photos</h1>
                    <p className="text-gray-500">Track your visual transformation over time.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-4 rounded shadow flex items-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Photos
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading gallery...</div>
            ) : entries.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded border border-dashed border-gray-300">
                    <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No photos yet</h3>
                    <p className="text-gray-500 mb-6">Upload your first progress check-in.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center text-gray-900 font-bold">
                                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                                    {new Date(entry.date).toLocaleDateString()}
                                </div>
                                <button onClick={() => handleDelete(entry.id)} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4 grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Front', url: entry.front_url },
                                    { label: 'Side', url: entry.side_url },
                                    { label: 'Back', url: entry.back_url }
                                ].map((photo, i) => (
                                    <div key={i} className="aspect-[3/4] bg-gray-100 rounded relative group overflow-hidden">
                                        {photo.url ? (
                                            <a href={photo.url} target="_blank" rel="noopener noreferrer">
                                                <img src={photo.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={photo.label} />
                                            </a>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-xs text-gray-300 uppercase font-bold">{photo.label}</div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-1 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                            {photo.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {(entry.weight || entry.notes) && (
                                <div className="px-4 py-3 bg-gray-50 text-xs text-gray-600 border-t border-gray-200">
                                    {entry.weight && <div className="font-bold mb-1">Weight: <span className="text-primary">{entry.weight} kg</span></div>}
                                    {entry.notes && <div className="italic">"{entry.notes}"</div>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Progress Entry">
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full border rounded p-2"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Weight (kg)</label>
                            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full border rounded p-2" placeholder="0.0" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">Photo URLs</label>
                        <input type="url" value={frontUrl} onChange={e => setFrontUrl(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Front View URL..." />
                        <input type="url" value={sideUrl} onChange={e => setSideUrl(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Side View URL..." />
                        <input type="url" value={backUrl} onChange={e => setBackUrl(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Back View URL..." />
                        <p className="text-xs text-gray-400">Paste direct image links (e.g. from Dropbox/Drive/Imgur).</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded p-2" rows={2} placeholder="How are you feeling?" />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={saving} className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow">
                            {saving ? "Saving..." : "Save Entry"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
