"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        console.log("Attempting login with:", email);

        try {
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado - verifica tu conexión")), 10000)
            );

            // Race against the login call
            const authPromise = supabase.auth.signInWithPassword({
                email,
                password,
            });

            const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any;

            console.log("Login result:", { data, error });

            if (error) throw error;

            setMessage({ type: 'success', text: '¡Inicio de sesión exitoso! Redirigiendo...' });
            setTimeout(() => {
                router.push("/dashboard");
            }, 500);

        } catch (error: any) {
            console.error("Login error:", error);

            // AGGRESSIVE RECOVERY: Check if session exists anyway
            // Some network aborts or strange client states might still result in a valid session
            console.log("Attempting aggressive session recovery...");
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log("Session FOUND during recovery. Redirecting...");
                    setMessage({ type: 'success', text: '¡Sesión verificada! Redirigiendo...' });
                    // Force hard reload if needed or just push
                    router.push("/dashboard");
                    return;
                }
            } catch (recoveryErr) {
                console.error("Recovery check failed:", recoveryErr);
            }

            setMessage({ type: 'error', text: error.message || "Ocurrió un error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">


                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Strength & Metabolic" className="h-24 w-auto" />
                </div>

                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                    Bienvenido de nuevo
                </h1>
                <p className="text-center text-gray-500 mb-8">
                    Inicia sesión para acceder a tu panel
                </p>

                {message && (
                    <div className={`p-4 rounded mb-4 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="tu@ejemplo.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-blue-900 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                    >
                        {loading ? "Procesando..." : "Iniciar Sesión"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p>Contacta a tu Super Admin para solicitar una cuenta.</p>
                </div>
            </div>
        </div>
    );
}
