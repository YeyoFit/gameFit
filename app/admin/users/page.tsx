"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('role', { ascending: true });

        if (error) console.error("Error fetching profiles:", error);
        else setProfiles(data || []);

        setLoading(false);
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
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: newUserRole })
                    .eq('id', editingUser.id);

                if (error) throw error;

                setFormStatus('success');
                setFormMessage(`User updated successfully!`);
                setTimeout(() => {
                    resetForm();
                    fetchUsers();
                }, 1500);

            } else {
                // CREATE FLOW
                const res = await fetch('/api/users/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: newUserEmail,
                        password: newUserPassword,
                        role: newUserRole,
                        requesterId: currentUser?.id
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to create user");
                }

                setFormStatus('success');
                setFormMessage(`User ${newUserEmail} created successfully!`);
                setNewUserEmail("");
                setNewUserPassword("");
                fetchUsers(); // Refresh list
            }

        } catch (err: any) {
            setFormStatus('error');
            setFormMessage(err.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    requesterId: currentUser?.id
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                alert(`FAILED: ${res.status} - ${JSON.stringify(errorData)}`);
            } else {
                alert("SUCCESS: User deleted successfully");
                fetchUsers();
            }
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
