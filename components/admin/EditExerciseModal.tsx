"use client";

import { X, Save, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

type DbExercise = {
    id: string;
    name: string;
    phase: string;
    body_part: string;
    created_at: string;
};

interface EditExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: DbExercise | null;
    onUpdate: (updatedExercise: DbExercise) => void;
    onCreate: (newExercise: DbExercise) => void;
    onDelete: (deletedId: string) => void;
}

export function EditExerciseModal({ isOpen, onClose, exercise, onUpdate, onCreate, onDelete }: EditExerciseModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState<Partial<DbExercise>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (exercise) {
            setFormData({
                name: exercise.name,
                phase: exercise.phase,
                body_part: exercise.body_part,
            });
            setConfirmDelete(false);
        } else {
            // Reset for create mode
            setFormData({
                name: '',
                phase: '',
                body_part: 'legs', // Default
            });
            setConfirmDelete(false);
        }
    }, [exercise, isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    const handleSave = async () => {
        setIsSaving(true);

        if (exercise) {
            // UPDATE EXISTING
            const { data, error } = await supabase
                .from('exercises')
                .update({
                    name: formData.name,
                    phase: formData.phase,
                    body_part: formData.body_part
                })
                .eq('id', exercise.id)
                .select()
                .single();

            setIsSaving(false);

            if (error) {
                alert("Error updating exercise: " + error.message);
            } else {
                onUpdate(data);
                onClose();
            }
        } else {
            // CREATE NEW
            const { data, error } = await supabase
                .from('exercises')
                .insert({
                    name: formData.name,
                    phase: formData.phase,
                    body_part: formData.body_part
                })
                .select()
                .single();

            setIsSaving(false);

            if (error) {
                alert("Error creating exercise: " + error.message);
            } else {
                onCreate(data);
                onClose();
            }
        }
    };

    const handleDelete = async () => {
        if (!exercise) return;

        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }

        setIsDeleting(true);
        const { error } = await supabase
            .from('exercises')
            .delete()
            .eq('id', exercise.id);

        setIsDeleting(false);

        if (error) {
            alert("Error deleting exercise: " + error.message);
        } else {
            onDelete(exercise.id);
            onClose();
        }
    };

    if (!isOpen) return null;

    const isEditMode = !!exercise;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                ref={overlayRef}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Exercise' : 'New Exercise'}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Exercise Name</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="e.g. Back Squat"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Body Part</label>
                        <select
                            value={formData.body_part || ''}
                            onChange={(e) => setFormData({ ...formData, body_part: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                        >
                            <option value="legs">legs</option>
                            <option value="chest">chest</option>
                            <option value="back">back</option>
                            <option value="shoulders">shoulders</option>
                            <option value="triceps">triceps</option>
                            <option value="biceps">biceps</option>
                            <option value="posterior chain">posterior chain</option>
                            <option value="abs">abs</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Phase / Category</label>
                        <input
                            type="text"
                            value={formData.phase || ''}
                            onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="e.g. Strength Phase 1"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-lg">
                    {isEditMode ? (
                        <button
                            onClick={handleDelete}
                            className={`flex items-center px-4 py-2 rounded text-sm font-bold transition-colors ${confirmDelete
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "text-red-600 hover:bg-red-50 hover:text-red-700"
                                }`}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : confirmDelete ? (
                                <>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Confirm Delete?
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </>
                            )}
                        </button>
                    ) : (
                        <div></div> /* Spacer for flex */
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-primary text-white px-4 py-2 rounded flex items-center font-bold hover:bg-blue-900 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? "Saving..." : (isEditMode ? "Save Changes" : "Create Exercise")}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
