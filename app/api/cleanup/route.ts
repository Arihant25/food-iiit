import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Helper to get meal time limits (in hours)
const getMealEndTime = (meal: string): number => {
    switch (meal.toLowerCase()) {
        case 'breakfast':
            return 10; // 10:00 AM
        case 'lunch':
            return 15; // 3:00 PM
        case 'snacks':
            return 19; // 7:00 PM
        case 'dinner':
            return 22; // 10:00 PM
        default:
            return 23; // Default to end of day
    }
};

/**
 * API route to clean up expired meal listings
 * 
 * This route will:
 * 1. Find all listings where the meal date has passed
 * 2. Delete those listings (or mark them as expired)
 * 
 * The route can be triggered by a cron job or manual request
 */
export async function GET(request: NextRequest) {
    try {
        // Get current date and time
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const currentHour = now.getHours();

        console.log(`Running cleanup at ${now.toISOString()}`);

        // Fetch listings that are candidates for cleanup
        // 1. Past dates - any meal from previous days
        // 2. Current date - meals whose end time has passed
        const { data: listings, error } = await supabase
            .from("listings")
            .select("id, date, meal")
            .or(`date.lt.${today}, and(date.eq.${today},meal.neq.'')`);

        if (error) {
            console.error("Error fetching expired listings:", error);
            return NextResponse.json(
                { error: "Failed to fetch expired listings" },
                { status: 500 }
            );
        }

        if (!listings || listings.length === 0) {
            return NextResponse.json(
                { message: "No expired listings found" },
                { status: 200 }
            );
        }

        // Filter listings to find those that are truly expired
        const expiredListingIds = listings
            .filter(listing => {
                // Past dates are always expired
                if (listing.date < today) {
                    return true;
                }

                // For current date, check if the meal time has passed
                if (listing.date === today) {
                    const mealEndTime = getMealEndTime(listing.meal);
                    return currentHour >= mealEndTime;
                }

                return false;
            })
            .map(listing => listing.id);

        if (expiredListingIds.length === 0) {
            return NextResponse.json(
                { message: "No expired listings to delete" },
                { status: 200 }
            );
        }

        console.log(`Found ${expiredListingIds.length} expired listings to delete`);

        // Delete expired listings
        const { error: deleteError } = await supabase
            .from("listings")
            .delete()
            .in("id", expiredListingIds);

        if (deleteError) {
            console.error("Error deleting expired listings:", deleteError);
            return NextResponse.json(
                { error: "Failed to delete expired listings" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: `Successfully deleted ${expiredListingIds.length} expired listings`,
            deleted: expiredListingIds.length
        });
    } catch (error) {
        console.error("Error in cleanup process:", error);
        return NextResponse.json(
            { error: "Cleanup process failed", details: String(error) },
            { status: 500 }
        );
    }
}
