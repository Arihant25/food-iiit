import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";

// API handler for proxying requests to the mess API
export async function GET(request: NextRequest) {
    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const meal = searchParams.get("meal");
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");

    // Validate required parameters
    if (!meal || !date) {
        return NextResponse.json(
            { error: "Missing required parameters: meal and date" },
            { status: 400 }
        );
    }

    // Ensure date is in yyyy-mm-dd format
    let formattedDate: string;
    try {
        formattedDate = new Date(date).toISOString().split('T')[0];
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid date format. Please use yyyy-mm-dd format." },
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
            } else if (data?.api_key) {
                apiKey = data.api_key;
            }
        }

        console.log("API Key:", apiKey);

        // Forward the request to the mess API with API key if available
        const messApiUrl = `https://mess.iiit.ac.in/api/registration?meal=${meal}&date=${formattedDate}`;
        const headers: HeadersInit = {};

        // Add authorization header if we have the API key
        if (apiKey) {
            // Set the Authorization header with the API key
            headers["Authorization"] = apiKey;
        }

        const response = await fetch(messApiUrl, {
            headers,
            credentials: "include",
        });

        // If unauthorized, return a special response indicating login is needed
        if (response.status === 401) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                    loginRequired: true,
                    loginUrl: "https://mess.iiit.ac.in/api/auth/login/cas"
                },
                { status: 401 }
            );
        }

        // If we get a successful response, extract the data
        const data = await response.json();
        if (!response.ok) {
            console.error("Error from mess API:", data);
            return NextResponse.json(
                { error: "Failed to fetch from mess API" },
                { status: response.status }
            );
        }

        console.log("Data from mess API:", data);

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching from mess API:", error);
        return NextResponse.json(
            { error: "Failed to fetch from mess API" },
            { status: 500 }
        );
    }
}