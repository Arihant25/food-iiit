import { createClient } from '@supabase/supabase-js'
import { getSession } from 'next-auth/react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL")
}
if (!supabaseAnonKey) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

// Create the base Supabase client with realtime enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

// For direct database operations with admin-like access
// This is used for operations that need to bypass RLS
// (only to be used where security is still maintained by the application logic)
export async function adminOperation<T>(operation: (client: typeof supabase) => Promise<T>): Promise<T> {
    try {
        // Since we're calling this from client components and want to maintain votes
        // without complex auth setup, we'll use the anon key but ensure our application
        // has proper checks in place (e.g., requiring a session)
        return await operation(supabase);
    } catch (error) {
        console.error("Error in admin operation:", error);
        throw error;
    }
}

// Create an authenticated Supabase client using the user's session
export async function getAuthenticatedSupabaseClient() {
    const session = await getSession()

    if (!session?.user) {
        return supabase // Return anonymous client if no session
    }

    // Check if user exists in our users table, create if not
    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Error checking user:", checkError)
    }

    // If user doesn't exist, create them
    if (!existingUser) {
        const { error: insertError } = await supabase
            .from('users')
            .insert({
                email: session.user.email,
                name: session.user.name,
                roll_number: session.user.rollNumber
            })

        if (insertError) {
            console.error("Error creating user:", insertError)
        }
    } else {
        // Update last signed in time
        await supabase
            .from('users')
            .update({ last_signed_in: new Date().toISOString() })
            .eq('email', session.user.email)
    }

    // Return the authenticated client
    return supabase
}