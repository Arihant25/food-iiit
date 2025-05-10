import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// API handler for fetching a user's token from the mess API
export async function GET(request: NextRequest) {
    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    // Validate required parameters
    if (!userId) {
        return NextResponse.json(
            { error: "Missing required parameter: userId" },
            { status: 400 }
        );
    }

    try {
        // Get the user's API key from the users table
        const { data: userData, error } = await supabase
            .from('users')
            .select('api_key')
            .eq('roll_number', userId)
            .single();

        if (error) {
            console.error("Error fetching user API key:", error);
            return NextResponse.json(
                { error: "User API key not found" },
                { status: 401 }
            );
        } else if (!userData?.api_key) {
            return NextResponse.json(
                { error: "User API key not set" },
                { status: 401 }
            );
        }

        const apiKey = userData.api_key;

        // Forward the request to the mess API to get user data (including token)
        const messApiUrl = `https://mess.iiit.ac.in/api/auth/me`;
        const headers: HeadersInit = {
            "Authorization": apiKey,
            "Content-Type": "application/json"
        };

        const response = await fetch(messApiUrl, {
            headers,
            credentials: "include",
        });

        // Handle various response statuses
        if (response.status === 401) {
            console.error("Unauthorized access to mess API. Invalid API key.");
            return NextResponse.json(
                {
                    error: "Invalid API key",
                    loginRequired: true
                },
                { status: 401 }
            );
        }

        // If we get a successful response, extract the data
        const messApiResponse = await response.json();
        if (!response.ok) {
            console.error("Error from mess API:", messApiResponse);
            return NextResponse.json(
                { error: "Failed to fetch from mess API", details: messApiResponse },
                { status: response.status }
            );
        }

        // Return just the token
        return NextResponse.json({ token: messApiResponse.data?.token || null });
    } catch (error) {
        console.error("Error fetching from mess API:", error);
        return NextResponse.json(
            { error: "Failed to fetch from mess API", details: String(error) },
            { status: 500 }
        );
    }
}
