"use client";

import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            ) : (
                <Sun className="w-5 h-5 text-yellow-400" />
            )}
        </button>
    );
}
