"use client";

import Link from "next/link";
import { LogOut, User, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
    const { user, role, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    if (!user) return null; // Don't show navbar on login screen

    return (
        <nav className="bg-white dark:bg-surface border-b border-border sticky top-0 z-10 shadow-sm transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            {/* Logo */}
                            <div className="flex items-center">
                                <img src="/logo.png" alt="Strength & Metabolic" className="h-12 w-auto" />
                            </div>
                        </div>
                        <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                            <Link
                                href="/dashboard"
                                className="border-transparent hover:border-primary text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                            >
                                Entrenamientos
                            </Link>

                            {(role === 'admin' || role === 'super_admin') && (
                                <>
                                    <Link
                                        href="/admin"
                                        className="border-transparent hover:border-primary text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                                    >
                                        Admin
                                    </Link>
                                    <Link
                                        href="/admin/users"
                                        className="border-transparent hover:border-primary text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                                    >
                                        Clientes
                                    </Link>
                                </>
                            )}

                            <Link
                                href="/reports"
                                className="border-transparent hover:border-primary text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                            >
                                Reportes
                            </Link>
                            <Link
                                href="/profile"
                                className="border-transparent hover:border-primary text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                            >
                                Perfil
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <ThemeToggle />

                        {/* Mobile Menu Button */}
                        <div className="flex items-center sm:hidden">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                            >
                                <span className="sr-only">Open main menu</span>
                                {isMenuOpen ? (
                                    <X className="block h-6 w-6" aria-hidden="true" />
                                ) : (
                                    <Menu className="block h-6 w-6" aria-hidden="true" />
                                )}
                            </button>
                        </div>

                        <Link href="/profile" className="text-xs text-right hidden sm:block hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors group">
                            <div className="font-bold text-primary group-hover:text-blue-600">{user.displayName || user.email}</div>
                            <div className="text-muted lowercase">{role}</div>
                        </Link>
                        <button
                            onClick={logout}
                            className="p-2 rounded-full text-muted hover:text-primary focus:outline-none hidden sm:flex items-center"
                        >
                            <LogOut className="w-5 h-5 mr-1" />
                            <span className="text-sm font-medium">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-surface">
                    <div className="pt-2 pb-3 space-y-1">
                        <Link
                            href="/dashboard"
                            onClick={() => setIsMenuOpen(false)}
                            className="bg-primary/5 border-l-4 border-primary text-primary block pl-3 pr-4 py-2 text-base font-medium"
                        >
                            Entrenamientos
                        </Link>
                        {(role === 'admin' || role === 'super_admin') && (
                            <>
                                <Link
                                    href="/admin"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                                >
                                    Admin
                                </Link>
                                <Link
                                    href="/admin/users"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                                >
                                    Clientes
                                </Link>
                            </>
                        )}
                        <Link
                            href="/reports"
                            onClick={() => setIsMenuOpen(false)}
                            className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                        >
                            Reportes
                        </Link>
                        <Link
                            href="/profile"
                            onClick={() => setIsMenuOpen(false)}
                            className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                        >
                            Perfil
                        </Link>
                    </div>
                    <div className="pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center px-4">
                            <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                                    {user.email?.[0].toUpperCase()}
                                </div>
                            </div>
                            <div className="ml-3">
                                <div className="text-base font-medium text-gray-800 dark:text-gray-200">{user.email}</div>
                                <div className="text-sm font-medium text-gray-500">{role}</div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    logout();
                                }}
                                className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:text-red-800 hover:bg-gray-100"
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
