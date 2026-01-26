"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { User, Camera, Save, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Fields
    const [fullName, setFullName] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    useEffect(() => {
        if (authLoading) return;
        if (!user) return;

        const fetchProfile = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setFullName(data.full_name || user.user_metadata?.full_name || "");
                setBirthdate(data.birthdate || "");
                setAvatarUrl(data.avatar_url || "");
            }
            setLoading(false);
        };

        fetchProfile();
    }, [user, authLoading]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                birthdate: birthdate || null,
                avatar_url: avatarUrl
            })
            .eq('id', user!.id);

        if (error) {
            setMessage("Error: " + error.message);
        } else {
            // Also update auth metadata for sync if possible, but skipping for now to keep it simple.
            // Using profiles table as source of truth for this page.
            setMessage("Profile updated successfully!");
        }
        setSaving(false);
    };

    if (loading || authLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="py-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                <Link
                    href="/profile/photos"
                    className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2 px-4 rounded shadow-sm flex items-center transition-colors"
                >
                    <Camera className="w-5 h-5 mr-2 text-primary" />
                    My Progress Photos
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">

                    {/* Avatar Section */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-4 border-white shadow-lg">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-16 h-16 text-gray-400" />
                            )}
                        </div>
                        <div className="w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Photo URL</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                    <Camera className="h-4 w-4" />
                                </span>
                                <input
                                    type="url"
                                    value={avatarUrl}
                                    onChange={e => setAvatarUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 sm:text-sm"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Paste a direct link to an image.</p>
                        </div>
                    </div>

                    {/* Form Section */}
                    <div className="flex-1">
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                    <input
                                        type="email"
                                        disabled
                                        value={user?.email || ""}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Contact your coach to change email.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Birthdate</label>
                                    <input
                                        type="date"
                                        value={birthdate}
                                        onChange={e => setBirthdate(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`p-4 rounded-md ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {message}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-primary hover:bg-blue-900 text-white font-bold py-2 px-6 rounded shadow flex items-center"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
