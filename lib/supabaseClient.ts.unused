import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Custom fetch with longer timeout
const customFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
    return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000), // 20s timeout
    });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    global: {
        fetch: customFetch
    }
})
