"use client";

import { useEffect, useState } from "react";
import { ExerciseForm } from "@/components/ExerciseForm";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";

export default function EditExercisePage() {
    const params = useParams();
    const id = params?.id as string;
    const [exercise, setExercise] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchEx = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'exercises', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setExercise({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching exercise:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEx();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!exercise) return <div className="text-center p-10">Exercise not found</div>;

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <Link href="/admin/exercises" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Library</span>
                </Link>
            </div>

            <div className="mb-8 text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900">Edit Exercise</h1>
            </div>

            <ExerciseForm initialData={exercise} />
        </div>
    );
}
