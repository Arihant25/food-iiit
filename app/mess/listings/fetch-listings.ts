import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// Helper to determine if a meal has expired based on its date and type
export function isMealExpired(mealDate: string, mealType: string): boolean {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // If the date is in the past, the meal is expired
    if (mealDate < today) {
        return true;
    }

    // If the date is in the future, the meal is not expired
    if (mealDate > today) {
        return false;
    }

    // For today, check based on meal type and current hour
    const currentHour = now.getHours();

    switch (mealType.toLowerCase()) {
        case 'breakfast':
            return currentHour >= 10; // After 10:00 AM
        case 'lunch':
            return currentHour >= 15; // After 3:00 PM
        case 'snacks':
            return currentHour >= 19; // After 7:00 PM
        case 'dinner':
            return currentHour >= 22; // After 10:00 PM
        default:
            return false;
    }
}

export async function fetchFilteredListings() {
    try {
        // Step 1: Get IDs of listings that have accepted bids
        const { data: acceptedBidsData, error: acceptedBidsError } = await supabase
            .from("bids")
            .select('listing_id')
            .eq('accepted', true);

        if (acceptedBidsError) {
            console.error("Error fetching accepted bids:", acceptedBidsError);
            toast.error("Failed to filter listings");
            return { data: [], error: acceptedBidsError };
        }

        // Step 2: Get all listings
        const { data: allListings, error: listingsError } = await supabase
            .from("listings")
            .select(`
                *,
                users:seller_id (
                    name,
                    email
                )
            `)
            .order("created_at", { ascending: false });

        if (listingsError) {
            console.error("Error fetching listings:", listingsError);
            toast.error("Failed to load listings");
            return { data: [], error: listingsError };
        }

        // Step 3: Collect all listing IDs with accepted bids
        const listingIdsWithAcceptedBids = new Set(
            acceptedBidsData
                ?.filter(bid => bid && bid.listing_id)
                .map(bid => bid.listing_id) || []
        );

        // Step 4: Filter out listings with accepted bids and expired meals
        const filteredListings = allListings.filter(
            listing => !listingIdsWithAcceptedBids.has(listing.id) &&
                !isMealExpired(listing.date, listing.meal)
        );

        // Step 5: Return the filtered listings
        return { data: filteredListings, error: null };
    } catch (error) {
        console.error("Error in fetchFilteredListings:", error);
        return { data: [], error };
    }
}

export async function getBidCounts(listingIds: string[]) {
    if (listingIds.length === 0) {
        return new Map<string, number>();
    }

    try {
        // Get the count of bids for each listing
        const { data: bidCountsData, error: bidCountsError } = await supabase
            .from("bids")
            .select('listing_id')
            .in('listing_id', listingIds);

        if (bidCountsError) {
            console.error("Error fetching bid counts:", bidCountsError);
            return new Map<string, number>();
        }

        // Create a map of listing IDs to bid counts
        const bidCountMap = new Map<string, number>();

        if (bidCountsData) {
            // Count bids per listing
            bidCountsData.forEach((bid: { listing_id: string }) => {
                const count = bidCountMap.get(bid.listing_id) || 0;
                bidCountMap.set(bid.listing_id, count + 1);
            });
        }

        return bidCountMap;
    } catch (error) {
        console.error("Error getting bid counts:", error);
        return new Map<string, number>();
    }
}
