"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2, Edit3, Dumbbell } from "lucide-react";

type Exercise = {
    id: string;
    name: string;
    body_part: string;
    video_url?: string;
    notes?: string;
};

export default function ExercisesPage() {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchExercises = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .order('name');

        if (error) console.error(error);
        else setExercises(data || []);

        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro? Esto podría afectar entrenamientos pasados si no se maneja correctamente.")) return;

        const { error } = await supabase.from('exercises').delete().eq('id', id);
        if (error) {
            alert("Error al eliminar: " + error.message);
        } else {
            setExercises(prev => prev.filter(e => e.id !== id));
        }
    };

    const filteredExercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ex.body_part?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex items-center mb-6">
                <Link href="/admin" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Volver al Panel de Admin</span>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Biblioteca de Ejercicios</h1>
                    <p className="text-gray-500">Gestionar ejercicios y videos disponibles.</p>
                </div>
                <Link
                    href="/admin/exercises/new"
                    className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Añadir Ejercicio
                </Link>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar ejercicios por nombre o parte del cuerpo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                {loading ? (
                    <div className="p-10 text-center text-gray-500">Cargando biblioteca...</div>
                ) : filteredExercises.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">No se encontraron ejercicios.</div>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {filteredExercises.map((ex) => (
                            <li key={ex.id} className="hover:bg-gray-50 transition-colors">
                                <div className="px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="bg-blue-100 p-2 rounded-full mr-4 text-primary">
                                            <Dumbbell className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{ex.name}</h3>
                                            <div className="flex space-x-2 mt-1">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {ex.body_part || 'Other'}
                                                </span>
                                                {ex.video_url && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Video Disponible
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Link
                                            href={`/admin/exercises/${ex.id}`}
                                            className="text-gray-400 hover:text-primary p-2"
                                            title="Editar"
                                        >
                                            <Edit3 className="w-5 h-5" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(ex.id)}
                                            className="text-gray-400 hover:text-red-500 p-2"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
