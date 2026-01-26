"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden"; // Prevent background scrolling
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Use createPortal to render at the root level, avoiding z-index issues
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Content */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">{title || "Video"}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-0 bg-black flex justify-center items-center min-h-[300px]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
