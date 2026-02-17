"use client";

import { useRef, useEffect, useState } from "react";
import { X, Plus, Minus, SkipForward } from "lucide-react";

interface RestTimerProps {
    isOpen: boolean;
    onClose: () => void;
    initialSeconds: number;
    exerciseName: string;
}

export function RestTimer({ isOpen, onClose, initialSeconds, exerciseName }: RestTimerProps) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context (user interaction usually required first, but we will try lazily)
    useEffect(() => {
        if (!isOpen) return;
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            audioContextRef.current = new AudioContext();
        }
        return () => {
            audioContextRef.current?.close();
            audioContextRef.current = null;
        };
    }, [isOpen]);

    const playBeep = () => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high beep
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    };

    const endTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Set target end time derived from initialSeconds
            endTimeRef.current = Date.now() + initialSeconds * 1000;
            setTimeLeft(initialSeconds);
        } else {
            endTimeRef.current = null;
        }
    }, [isOpen, initialSeconds]);

    useEffect(() => {
        if (!isOpen || !endTimeRef.current) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const end = endTimeRef.current!;
            const remaining = Math.ceil((end - now) / 1000);

            if (remaining <= 0) {
                setTimeLeft(0);
                playBeep();
                clearInterval(interval);
            } else {
                setTimeLeft(remaining);
            }
        }, 100); // Check more frequently for smoothness, but UI updates only on integer change really

        return () => clearInterval(interval);
    }, [isOpen]);

    const addTime = (seconds: number) => {
        if (endTimeRef.current) {
            endTimeRef.current += seconds * 1000;
            // Force immediate update
            const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
            setTimeLeft(Math.max(0, remaining));
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8 text-center">
                    <h3 className="text-gray-500 font-medium uppercase tracking-wider text-sm mb-2">Resting...</h3>
                    <div className="text-primary font-bold text-lg mb-6 truncate px-4">{exerciseName}</div>

                    <div className="text-7xl font-black text-gray-900 font-mono mb-8 tabular-nums">
                        {formatTime(Math.max(0, timeLeft))}
                    </div>

                    <div className="flex justify-center items-center space-x-6 mb-8">
                        <button
                            onClick={() => addTime(-10)}
                            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        >
                            <Minus className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => addTime(30)}
                            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        >
                            <Plus className="w-6 h-6 text-primary" />
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-primary hover:bg-blue-900 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center"
                    >
                        <SkipForward className="w-5 h-5 mr-2" />
                        Skip Rest
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100 w-full">
                    <div
                        className="h-full bg-green-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${Math.min(100, (timeLeft / initialSeconds) * 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
