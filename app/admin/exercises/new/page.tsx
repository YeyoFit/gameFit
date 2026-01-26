"use client";

import { ExerciseForm } from "@/components/ExerciseForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewExercisePage() {
    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <Link href="/admin/exercises" className="flex items-center text-muted hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="font-medium text-sm">Back to Library</span>
                </Link>
            </div>

            <div className="mb-8 text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900">Add New Exercise</h1>
            </div>

            <ExerciseForm />
        </div>
    );
}
