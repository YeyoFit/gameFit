"use client";

import { Exercise, LogSet } from "@/lib/mockData";
import { Play, Trophy, Camera, Video, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabaseClient";

interface ExerciseCardProps {
    exercise: Exercise;
    onLogChange: (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'completed' | 'videoUrl', value: any) => void;
}

export function ExerciseCard({ exercise, onLogChange }: ExerciseCardProps) {
    const logs = exercise.logs; // Use logs from props
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploadingSetIndex, setUploadingSetIndex] = useState<number | null>(null);

    // Real-time stats
    const [stats, setStats] = useState({
        avgWeight: 0,
        totalTonnage: 0,
        avgReps: 0,
        totalReps: 0
    });

    useEffect(() => {
        // Calculate stats whenever logs change. Only count COMPLETED sets.
        const completedLogs = logs.filter(l => l.completed && (l.weight !== null && l.weight > 0) && (l.reps !== null && l.reps > 0));

        if (completedLogs.length === 0) {
            setStats({ avgWeight: 0, totalTonnage: 0, avgReps: 0, totalReps: 0 });
            return;
        }

        const totalW = completedLogs.reduce((acc, curr) => acc + (curr.weight || 0), 0);
        const totalR = completedLogs.reduce((acc, curr) => acc + (curr.reps || 0), 0);
        const totalTon = completedLogs.reduce((acc, curr) => acc + ((curr.weight || 0) * (curr.reps || 0)), 0);

        setStats({
            avgWeight: totalW / completedLogs.length,
            totalTonnage: totalTon,
            avgReps: totalR / completedLogs.length,
            totalReps: totalR
        });
    }, [logs]);

    const handleInputChange = (index: number, field: 'weight' | 'reps', value: string) => {
        // Allow empty string to clear input
        const numValue = value === '' ? null : parseFloat(value);
        onLogChange(exercise.id, index, field, numValue);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, setIndex: number) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingSetIndex(setIndex);

        try {
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage
                .from('workout-videos')
                .upload(fileName, file);

            if (error) {
                console.error("Upload error:", error);
                alert("Error uploading video.");
                return;
            }

            const { data: publicData } = supabase.storage
                .from('workout-videos')
                .getPublicUrl(fileName);

            onLogChange(exercise.id, setIndex, 'videoUrl', publicData.publicUrl);

        } catch (err) {
            console.error(err);
        } finally {
            setUploadingSetIndex(null);
        }
    };

    return (
        <>
            <div className="bg-white border border-gray-300 rounded-sm mb-8 shadow-sm">
                {/* Header Bar */}
                <div className="bg-gray-100 p-2 flex items-center justify-between border-b border-gray-300">
                    <div className="flex items-center space-x-2">
                        <div className="bg-primary text-white font-bold w-8 h-8 flex items-center justify-center rounded-sm text-lg">
                            {exercise.order}
                        </div>
                        <h3 className="font-bold text-lg text-primary underline decoration-2 underline-offset-2">
                            {exercise.name}
                        </h3>
                    </div>
                    {exercise.videoUrl && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-primary hover:text-blue-800 transition-transform hover:scale-110"
                            title="Watch Video"
                        >
                            <Play className="w-8 h-8 fill-current" />
                        </button>
                    )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-12 text-center text-xs border-b border-gray-300 bg-gray-50">
                    {/* Header Row */}
                    <div className="col-span-1 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Order</div>
                    <div className="col-span-1 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Range</div>
                    <div className="col-span-1 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Sets</div>
                    <div className="col-span-2 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Rep Int</div>
                    <div className="col-span-1 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Tempo</div>
                    <div className="col-span-2 border-r border-gray-300 p-1 font-bold text-gray-500 uppercase">Rest (secs)</div>
                    <div className="col-span-4 p-1 font-bold text-gray-500 uppercase text-left pl-2">Notes</div>

                    {/* Value Row */}
                    <div className="col-span-1 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">{exercise.order}</div>
                    <div className="col-span-1 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">-</div>
                    <div className="col-span-1 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">{exercise.setsTarget}</div>
                    <div className="col-span-2 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">{exercise.repsTarget}</div>
                    <div className="col-span-1 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">{exercise.tempo}</div>
                    <div className="col-span-2 border-r border-gray-300 border-t border-gray-200 p-2 font-bold text-primary">{exercise.rest}</div>
                    <div className="col-span-4 border-t border-gray-200 p-2 text-left bg-yellow-50 text-gray-700 text-xs italic">
                        {exercise.notes || "No specific notes for this exercise."}
                    </div>
                </div>

                {/* Content Area: Inputs and Stats */}
                <div className="p-4 flex flex-col gap-6">

                    {/* Input Log */}
                    <div>
                        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '30px 1fr 1fr 50px 40px' }}>
                            <div className="font-bold text-gray-500 text-center text-xs">#</div>
                            <div className="font-bold text-primary text-center text-sm">Weight</div>
                            <div className="font-bold text-primary text-center text-sm">Reps</div>
                            <div className="font-bold text-primary text-center text-sm">✓</div>
                            <div className="font-bold text-primary text-center text-xs">🎥</div>
                        </div>

                        {logs.map((log, idx) => (
                            <div key={idx} className={`grid gap-2 mb-2 items-center transition-colors ${log.completed ? 'opacity-50' : ''}`} style={{ gridTemplateColumns: '30px 1fr 1fr 50px 40px' }}>
                                <div className="font-bold text-gray-400 text-sm text-center">{idx + 1}</div>
                                <div className="relative w-full">
                                    <input
                                        type="number"
                                        value={log.weight ?? ''}
                                        onChange={(e) => handleInputChange(idx, 'weight', e.target.value)}
                                        className={`w-full min-w-0 border p-2 text-center text-primary font-bold rounded-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none ${log.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-300'
                                            } ${log.isPR ? 'border-yellow-400 ring-2 ring-yellow-400 bg-yellow-50' : ''}`} // Highlight PR
                                        placeholder={log.prevWeight ? String(log.prevWeight) : "0"}
                                    />
                                    {log.isPR && (
                                        <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-0.5 shadow-sm z-10 animate-bounce">
                                            <Trophy className="w-3 h-3 text-white fill-current" />
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    value={log.reps ?? ''}
                                    onChange={(e) => handleInputChange(idx, 'reps', e.target.value)}
                                    className={`w-full min-w-0 border p-2 text-center text-primary font-bold rounded-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none ${log.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-300'
                                        }`}
                                    placeholder={log.prevReps ? String(log.prevReps) : "0"}
                                />
                                <div className="flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={log.completed}
                                        onChange={(e) => onLogChange(exercise.id, idx, 'completed', e.target.checked)}
                                        className="w-6 h-6 text-green-600 rounded focus:ring-green-500 border-gray-300 cursor-pointer"
                                    />
                                </div>
                                <div className="flex justify-center items-center">
                                    {uploadingSetIndex === idx ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    ) : log.videoUrl ? (
                                        <a href={log.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                            <Video className="w-6 h-6" />
                                        </a>
                                    ) : (
                                        <label className="cursor-pointer text-gray-400 hover:text-gray-600 flex items-center justify-center w-full h-full">
                                            <Camera className="w-5 h-5" />
                                            <input
                                                type="file"
                                                accept="video/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, idx)}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Table */}
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Session Stats</h4>
                        <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                                <span className="block text-gray-500">Avg Weight</span>
                                <span className="block font-bold text-primary text-lg">{stats.avgWeight.toFixed(1)}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500">Total Reps</span>
                                <span className="block font-bold text-primary text-lg">{stats.totalReps}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500">Tonnage</span>
                                <span className="block font-bold text-primary text-lg">
                                    {stats.totalTonnage >= 1000
                                        ? `${(stats.totalTonnage / 1000).toFixed(1)}k`
                                        : `${stats.totalTonnage}kg`
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Video Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={exercise.name}
            >
                {exercise.videoUrl ? (
                    <iframe
                        width="100%"
                        height="500"
                        src={(() => {
                            const url = exercise.videoUrl;
                            if (url.includes("youtube.com/watch?v=")) {
                                return url.replace("watch?v=", "embed/");
                            }
                            if (url.includes("youtu.be/")) {
                                return url.replace("youtu.be/", "www.youtube.com/embed/");
                            }
                            return url;
                        })()}
                        title="Video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full aspect-video"
                    ></iframe>
                ) : (
                    <div className="text-white">No video available</div>
                )}
            </Modal>
        </>
    );
}
