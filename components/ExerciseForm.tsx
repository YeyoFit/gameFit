"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type ExerciseFormProps = {
    initialData?: {
        id?: string;
        name: string;
        body_part: string;
        video_url?: string;
        notes?: string;
    } | null;
};

const BODY_PARTS = [
    "Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Core", "Cardio", "Cuerpo Completo", "Otro"
];

export function ExerciseForm({ initialData }: ExerciseFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(initialData?.name || "");
    const [bodyPart, setBodyPart] = useState(initialData?.body_part || "Other");
    const [videoUrl, setVideoUrl] = useState(initialData?.video_url || "");
    const [notes, setNotes] = useState(initialData?.notes || "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            name,
            body_part: bodyPart,
            video_url: videoUrl,
            notes
        };

        let result;
        if (initialData?.id) {
            // Update
            result = await supabase
                .from('exercises')
                .update(payload)
                .eq('id', initialData.id);
        } else {
            // Create
            result = await supabase
                .from('exercises')
                .insert(payload);
        }

        const { error } = result;

        if (error) {
            alert("Error: " + error.message);
            setLoading(false);
        } else {
            router.push("/admin/exercises");
            router.refresh();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 max-w-2xl mx-auto border border-gray-200">
            <div className="mb-6 space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Ejercicio</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
                        placeholder="ej. Sentadilla con Barra"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Parte del Cuerpo</label>
                    <select
                        value={bodyPart}
                        onChange={e => setBodyPart(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
                    >
                        {BODY_PARTS.map(part => (
                            <option key={part} value={part}>{part}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">URL de Video (Opcional)</label>
                    <input
                        type="url"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
                        placeholder="https://youtube.com/..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Enlace a un video demostrativo.</p>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Notas / Instrucciones</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
                        placeholder="Mantén el pecho arriba, espalda recta..."
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
                <Link href="/admin/exercises" className="mr-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                    Cancelar
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {initialData?.id ? "Actualizar Ejercicio" : "Crear Ejercicio"}
                </button>
            </div>
        </form>
    );
}
