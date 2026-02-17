"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

// Define our role type
export type UserRole = 'admin' | 'user' | 'super_admin';

type AuthContextType = {
    user: FirebaseUser | null;
    role: UserRole | null;
    loading: boolean;
    signOut: () => Promise<void>;
    logout: () => Promise<void>; // Alias
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        // Firebase Auth Listener
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser?.email);

            if (currentUser) {
                setUser(currentUser);
                // Fetch Role from Firestore
                await fetchUserRole(currentUser);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchUserRole = async (currentUser: FirebaseUser) => {
        if (!db) {
            setRole('user');
            setLoading(false);
            return;
        }
        try {
            // Master Admin Hardcode (Safety net)
            if (currentUser.email?.toLowerCase() === 'mazomalote@gmail.com') {
                console.log("⚠️ Force-enabling Super Admin for master account");
                setRole('super_admin');

                // Ensure this user exists in Firestore with correct role
                const userRef = doc(db, "users", currentUser.uid);
                await setDoc(userRef, {
                    email: currentUser.email,
                    role: 'super_admin',
                    lastSeen: new Date().toISOString()
                }, { merge: true });

                setLoading(false);
                return;
            }

            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log("User Data from Firestore:", userData);
                setRole(userData.role as UserRole);
            } else {
                console.log("User document not found in Firestore. Creating default...");
                // Create user profile if it doesn't exist (default role: user)
                await setDoc(userRef, {
                    email: currentUser.email,
                    role: 'user',
                    createdAt: new Date().toISOString()
                });
                setRole('user');
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            setRole('user'); // Default fallback
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const logout = signOut;

    return (
        <AuthContext.Provider value={{ user, role, loading, signOut, logout }}>
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
