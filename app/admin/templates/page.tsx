"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, writeBatch, where } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, FileText, Layers } from "lucide-react";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        const firestore = db;
        if (!firestore) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(collection(firestore, 'workout_templates'), orderBy('name'));
            const querySnapshot = await getDocs(q);
            const tmplList: any[] = [];
            querySnapshot.forEach((doc) => {
                tmplList.push({ id: doc.id, ...doc.data() });
            });
            setTemplates(tmplList);
        } catch (error) {
            console.error("Error loading templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const firestore = db;
        if (!confirm("Delete this template?")) return;
        if (!firestore) return;

        try {
            const batch = writeBatch(firestore);

            // Delete template exercises first
            const qEx = query(collection(firestore, 'workout_template_exercises'), where('template_id', '==', id));
            const exSnap = await getDocs(qEx);
            exSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete template
            const tmplRef = doc(firestore, 'workout_templates', id);
            batch.delete(tmplRef);

            await batch.commit();

            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (error: any) {
            alert("Error deleting template: " + error.message);
        }
    };

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <Link href="/admin" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Admin Dashboard</span>
                </Link>
            </div>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Workout Templates</h1>
                    <p className="text-gray-500">Create reusable routines for quick assignment.</p>
                </div>
                <Link
                    href="/admin/templates/new"
                    className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-4 rounded shadow flex items-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    New Template
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                    <div key={template.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                                <Layers className="w-6 h-6" />
                            </div>
                            <button onClick={() => handleDelete(template.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{template.name}</h3>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                            {template.description || "No description."}
                        </p>
                        <div className="border-t border-gray-100 pt-4">
                            <Link
                                href={`/admin/templates/${template.id}`}
                                className="text-primary font-bold text-sm hover:underline"
                            >
                                Edit Template &rarr;
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
