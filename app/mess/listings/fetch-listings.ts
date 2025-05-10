import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

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

        // Step 4: Filter out listings with accepted bids
        const filteredListings = allListings.filter(
            listing => !listingIdsWithAcceptedBids.has(listing.id)
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
