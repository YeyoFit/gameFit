"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type AuthContextType = {
    user: User | null;
    session: Session | null;
    role: 'admin' | 'user' | 'super_admin' | null;
    loading: boolean;
    signIn: (email: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    logout: () => Promise<void>; // Alias for compatibility
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<'admin' | 'user' | 'super_admin' | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            console.log("AuthContext: initSession starting...");
            try {
                // 1. Get initial session with fail-safe timeout
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Session init timeout")), 5000)
                );

                const { data: { session }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any;

                if (error) throw error;

                if (isMounted) {
                    setSession(session);
                    setUser(session?.user ?? null);

                    if (session?.user) {
                        console.log("AuthContext: User found, fetching role...");
                        // Safely fetch role without aborting
                        await fetchRole(session.user.id, session.user.email);
                    } else {
                        console.log("AuthContext: No user, loading done.");
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error("Auth init session error:", error);
                if (isMounted) setLoading(false);
            }
        };

        initSession();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (isMounted) {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchRole(session.user.id, session.user.email);
                } else {
                    setRole(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchRole = async (userId: string, email?: string) => {
        try {
            console.log(`AuthContext: fetchRole for ${userId} (${email})`);

            // IMMEDIATELY check for hardcoded super admin
            if (email && email.toLowerCase() === 'mazomalote@gmail.com') {
                console.log("⚠️ Force-enabling Super Admin for master account (PRE-CHECK)");
                setRole('super_admin');
                setLoading(false);
                return;
            }

            // Use RPC to get role safely, bypassing potential RLS recursion
            // Added 3s timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Role fetch timeout")), 3000)
            );

            // Cast to any to handle the race type mix
            const { data, error } = await Promise.race([
                supabase.rpc('get_my_role'),
                timeoutPromise
            ]) as any;

            if (error) throw error;

            console.log("AuthContext: fetchRole success:", data);

            if (data) {
                setRole(data as 'admin' | 'user' | 'super_admin');
            } else {
                setRole('user'); // Default to user if no role found
            }
        } catch (err) {
            console.error("Error OR Timeout fetching role", err);
            setRole('user'); // Default to user on error
        } finally {
            console.log("AuthContext: Loading set to FALSE");
            setLoading(false);
        }
    };

    const signIn = async (email: string) => {
        // Generic helper if used elsewhere, but Login Page uses direct calls
        const { error } = await supabase.auth.signInWithOtp({ email });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const logout = signOut; // Alias

    return (
        <AuthContext.Provider value={{ user, session, role, loading, signIn, signOut, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
