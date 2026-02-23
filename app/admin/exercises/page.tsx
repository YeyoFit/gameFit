"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, deleteDoc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2, Edit3, Dumbbell, Database, Loader2 } from "lucide-react";
import { SCRAPED_EXERCISES } from "@/lib/scrapedExercises";

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
    const [seeding, setSeeding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchExercises = async () => {
        const firestore = db;
        if (!firestore) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(collection(firestore, 'exercises'), orderBy('name'));
            const querySnapshot = await getDocs(q);
            const exList: Exercise[] = [];
            querySnapshot.forEach((doc) => {
                exList.push({ id: doc.id, ...doc.data() } as Exercise);
            });
            setExercises(exList);
        } catch (error) {
            console.error("Error loading exercises:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSeed = async () => {
        const firestore = db;
        if (!firestore) return;
        if (!confirm(`¿Estás seguro de que quieres cargar ${SCRAPED_EXERCISES.length} ejercicios predefinidos?`)) return;

        setSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const exercisesRef = collection(firestore, 'exercises');

            // Deduplicate: Only add exercises that don't exist by name
            const existingNames = new Set(exercises.map(ex => ex.name.toLowerCase()));
            const newExercises = SCRAPED_EXERCISES.filter(ex => !existingNames.has(ex.name.toLowerCase()));

            if (newExercises.length === 0) {
                alert("¡Todos los ejercicios ya están en la biblioteca!");
                setSeeding(false);
                return;
            }

            if (!confirm(`Se añadirán ${newExercises.length} ejercicios nuevos. ¿Continuar?`)) {
                setSeeding(false);
                return;
            }

            newExercises.forEach((ex) => {
                const newDocRef = doc(exercisesRef);
                batch.set(newDocRef, {
                    name: ex.name,
                    phase: ex.phase,
                    body_part: ex.bodyPart,
                    created_at: new Date().toISOString()
                });
            });

            await batch.commit();
            alert("¡Biblioteca sembrada con éxito!");
            fetchExercises();
        } catch (error: any) {
            console.error("Error seeding:", error);
            alert("Error al sembrar: " + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleDelete = async (id: string) => {
        const firestore = db;
        if (!firestore) return;
        if (!confirm("¿Estás seguro? Esto podría afectar entrenamientos pasados si no se maneja correctamente.")) return;

        try {
            await deleteDoc(doc(firestore, 'exercises', id));
            setExercises(prev => prev.filter(e => e.id !== id));
        } catch (error: any) {
            alert("Error al eliminar: " + error.message);
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
                <div className="flex gap-2">
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center transition-colors"
                    >
                        {seeding ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Database className="w-5 h-5 mr-2" />}
                        {exercises.length === 0 ? "Sembrar Biblioteca" : "Actualizar Ejercicios"}
                    </button>
                    <Link
                        href="/admin/exercises/new"
                        className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Añadir Ejercicio
                    </Link>
                </div>
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
                    <div className="p-20 text-center text-gray-500 flex flex-col items-center">
                        <Dumbbell className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="mb-4">No se encontraron ejercicios en la base de datos.</p>
                        <button
                            onClick={handleSeed}
                            disabled={seeding}
                            className="text-primary font-bold hover:underline flex items-center"
                        >
                            {seeding ? "Cargando..." : "Haz clic aquí para cargar la biblioteca inicial"}
                        </button>
                    </div>
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
