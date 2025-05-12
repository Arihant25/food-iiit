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
        // Forward the request to the mess menu API
        const messApiUrl = `https://mess.iiit.ac.in/api/mess/menu/${mess}`;
        const headers: HeadersInit = {
            // Note that the menu API does not require an API key
            "Content-Type": "application/json"
        };

        const response = await fetch(messApiUrl, {
            headers,
            credentials: "include",
        });

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
