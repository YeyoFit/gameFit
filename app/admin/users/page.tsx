"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase"; // Default app
import { collection, query, orderBy, getDocs, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getApp, getApps, initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { Plus, User, Shield, ShieldAlert, Mail, Trash2 } from "lucide-react";
import Link from "next/link";

type Profile = {
    id: string;
    email: string;
    role: string;
    created_at?: string;
};

export default function UsersPage() {
    const { user: currentUser, role: currentRole, loading: authLoading } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState(""); // Only for creation
    const [newUserRole, setNewUserRole] = useState("user");
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [formMessage, setFormMessage] = useState("");

    // Edit State
    const [editingUser, setEditingUser] = useState<Profile | null>(null);

    // Delete State
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        fetchUsers();
    }, [authLoading]);

    const fetchUsers = async () => {
        if (!db) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), orderBy('role'));
            const querySnapshot = await getDocs(q);
            const usersList: Profile[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                usersList.push({
                    id: doc.id,
                    email: data.email || "", // Email might not be in user doc if not copied, but we should have it
                    role: data.role || "user",
                    created_at: data.created_at
                });
            });
            setProfiles(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("user");
        setEditingUser(null);
        setFormStatus('idle');
        setFormMessage("");
        setIsCreating(false);
    }

    const startEditing = (profile: Profile) => {
        setEditingUser(profile);
        setNewUserEmail(profile.email);
        setNewUserRole(profile.role);
        setFormStatus('idle');
        setFormMessage("");
        setIsCreating(true); // Re-use the modal/area
    };

    const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('submitting');
        setFormMessage("");

        try {
            if (editingUser) {
                // UPDATE FLOW (Database update only for Role for now)
                if (!db) return;
                const userRef = doc(db, 'users', editingUser.id);
                await updateDoc(userRef, { role: newUserRole });

                setFormStatus('success');
                setFormMessage(`User updated successfully!`);
                setTimeout(() => {
                    resetForm();
                    fetchUsers();
                }, 1500);

            } else {
                // CREATE FLOW (Client-side workaround using secondary app)
                // 1. Initialize secondary app
                const firebaseConfig = {
                    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
                };

                const secondaryApp = initializeApp(firebaseConfig, "Secondary");
                const secondaryAuth = getAuth(secondaryApp);

                try {
                    // 2. Create User
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
                    const newUid = userCredential.user.uid;

                    // 3. Sign out from secondary app immediately
                    await signOut(secondaryAuth);

                    // 4. Create User Document in Firestore (using PRIMARY admin auth)
                    // We can write to 'users' collection because we are Admin
                    if (!db) return;
                    await setDoc(doc(db, 'users', newUid), {
                        email: newUserEmail,
                        role: newUserRole,
                        created_at: new Date().toISOString()
                    });

                    setFormStatus('success');
                    setFormMessage(`User ${newUserEmail} created successfully!`);
                    setNewUserEmail("");
                    setNewUserPassword("");
                    fetchUsers(); // Refresh list
                    setTimeout(() => {
                        resetForm();
                    }, 1500);

                } catch (createError: any) {
                    throw createError;
                } finally {
                    // 5. Cleanup secondary app
                    deleteApp(secondaryApp);
                }
            }

        } catch (err: any) {
            setFormStatus('error');
            setFormMessage(err.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setLoading(true);
        try {
            // Soft Delete / Hard Delete from Firestore
            // We cannot delete from Auth without Admin SDK.
            // But we can delete the 'users' document, which effectively hides them and removes their role.

            // 1. Delete user document from Firestore
            if (!db) throw new Error("Database not initialized");
            await deleteDoc(doc(db, 'users', userId));

            // Optional: We could call the API if it was working, but we know it's not migrated.
            // For now, this is a "Ban" effectively.

            alert("SUCCESS: User data deleted from database. (Auth account remains but inactive)");
            fetchUsers();

        } catch (err: any) {
            console.error("Delete error:", err);
            alert(`CRITICAL ERROR: ${err.message}`);
        } finally {
            setLoading(false);
            setUserToDelete(null); // Reset
        }
    };

    if (authLoading) return <div className="p-8">Loading auth...</div>;

    // double check protection
    if (!authLoading && currentRole !== 'super_admin') {
        return (
            <div className="p-8 text-red-500">
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>You must be a Super Admin to view this page.</p>
                <p className="text-sm text-gray-400 mt-2">Current Role: {currentRole || 'None'}</p>
            </div>
        );
    }

    return (
        <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500">Manage system access and roles</p>
                </div>
                <button
                    onClick={() => {
                        if (isCreating) resetForm();
                        else setIsCreating(true);
                    }}
                    className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded shadow flex items-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    {isCreating ? "Cancel" : "Add New User"}
                </button>
            </div>

            {/* Creation/Edit Form */}
            {isCreating && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8 max-w-xl animate-in slide-in-from-top-4">
                    <h2 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Create New Account'}</h2>
                    <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input
                                type="email"
                                required
                                disabled={!!editingUser}
                                value={newUserEmail}
                                onChange={e => setNewUserEmail(e.target.value)}
                                className={`mt-1 w-full p-2 border rounded ${editingUser ? 'bg-gray-100' : ''}`}
                                placeholder="jane@example.com"
                            />
                            {editingUser && <p className="text-xs text-gray-500 mt-1">Email cannot be changed here yet.</p>}
                        </div>

                        {!editingUser && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserPassword}
                                    onChange={e => setNewUserPassword(e.target.value)}
                                    className="mt-1 w-full p-2 border rounded"
                                    placeholder="Temporary password"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Role</label>
                            <select
                                value={newUserRole}
                                onChange={e => setNewUserRole(e.target.value)}
                                className="mt-1 w-full p-2 border rounded bg-white"
                            >
                                <option value="user">User (Athlete)</option>
                                <option value="admin">Admin (Coach)</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>

                        {formStatus === 'error' && (
                            <div className="p-3 bg-red-100 text-red-700 text-sm rounded">{formMessage}</div>
                        )}
                        {formStatus === 'success' && (
                            <div className="p-3 bg-green-100 text-green-700 text-sm rounded">{formMessage}</div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={formStatus === 'submitting'}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold"
                            >
                                {formStatus === 'submitting' ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Users List */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading directory...</td></tr>
                        ) : profiles.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <User className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{p.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${p.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                            p.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {p.role === 'super_admin' && <ShieldAlert className="w-3 h-3 mr-1 inline" />}
                                        {p.role === 'admin' && <Shield className="w-3 h-3 mr-1 inline" />}
                                        {p.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                    {p.id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <Link
                                            href={`/admin/users/${p.id}`}
                                            className="text-white bg-indigo-600 hover:bg-indigo-700 font-medium text-sm px-3 py-1 rounded shadow-sm transition-colors"
                                        >
                                            Manage
                                        </Link>

                                        {userToDelete === p.id ? (
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteUser(p.id);
                                                    }}
                                                    className="text-white bg-red-700 hover:bg-red-800 font-bold text-xs px-2 py-1 rounded shadow-sm whitespace-nowrap"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setUserToDelete(null);
                                                    }}
                                                    className="text-gray-600 hover:text-gray-800 font-medium text-xs px-2 py-1"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setUserToDelete(p.id);
                                                }}
                                                className="text-white bg-red-600 hover:bg-red-700 font-medium text-sm px-3 py-1 rounded shadow-sm transition-colors flex items-center"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
