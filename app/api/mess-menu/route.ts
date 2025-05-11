import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// API handler for proxying requests to the mess menu API
export async function GET(request: NextRequest) {
    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const mess = searchParams.get("mess");
    const userId = searchParams.get("userId");

    // Validate required parameters
    if (!mess) {
        return NextResponse.json(
            { error: "Missing required parameter: mess" },
            { status: 400 }
        );
    }

    try {
        // Get the user's API key from the users table
        let apiKey = null;
        if (userId) {
            const { data, error } = await supabase
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
            } else if (data?.api_key) {
                apiKey = data.api_key;
            } else {
                return NextResponse.json(
                    { error: "User API key not set" },
                    { status: 401 }
                );
            }
        } else {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            );
        }

        console.log("Using API Key for user:", userId);

        // Forward the request to the mess menu API with API key
        const messApiUrl = `https://mess.iiit.ac.in/api/mess/menu/${mess}`;
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
        const data = await response.json();
        if (!response.ok) {
            console.error("Error from mess API:", data);
            return NextResponse.json(
                { error: "Failed to fetch from mess API", details: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching from mess API:", error);
        return NextResponse.json(
            { error: "Failed to fetch from mess API", details: String(error) },
            { status: 500 }
        );
    }
}
