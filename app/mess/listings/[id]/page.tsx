"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { format } from "date-fns"
import { CalendarDays, Clock, User, Phone, AlertCircle, ArrowLeft, Edit2, AlertTriangle, Share2 } from "lucide-react"
import { isMealExpired } from "../fetch-listings"

// Helper function to format dates consistently throughout the component
const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
}

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import UserAuthForm from "@/components/auth/UserAuthForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

interface Listing {
    id: string
    min_price: number
    date: string
    meal: string
    mess: string
    seller_id: string
    created_at: string
    seller: {
        name: string
        email: string
        phone_number: string | null
    }
}

interface Bid {
    id: string
    buyer_roll_number: string
    listing_id: string
    bid_price: number
    created_at: string
    accepted: boolean
    paid: boolean
    buyer?: {
        name: string
        email: string
        phone_number: string | null
    }
}

interface MenuItem {
    category: string
    item: string
}

interface MessMenu {
    days: Record<string, {
        breakfast: MenuItem[]
        lunch: MenuItem[]
        dinner: MenuItem[]
    }>
    updated_at: string
    effective_from: string
    mess: string
}

interface MenuItem {
    category: string
    item: string
}

interface MessMenu {
    days: Record<string, {
        breakfast: MenuItem[]
        lunch: MenuItem[]
        dinner: MenuItem[]
    }>
    updated_at: string
    effective_from: string
    mess: string
}

export default function ListingDetailPage() {
    const router = useRouter()
    const { id } = useParams() as { id: string }
    const { data: session, status } = useSession()

    const [listing, setListing] = useState<Listing | null>(null)
    const [loading, setLoading] = useState(true)
    const [bids, setBids] = useState<Bid[]>([])
    const [userHasBid, setUserHasBid] = useState(false)
    const [userBidAmount, setUserBidAmount] = useState(0)
    const [bidAmount, setBidAmount] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [completingTransaction, setCompletingTransaction] = useState(false)
    const [showAuthForm, setShowAuthForm] = useState(false)
    const [editMinPrice, setEditMinPrice] = useState(false)
    const [newMinPrice, setNewMinPrice] = useState("")
    const [updatingPrice, setUpdatingPrice] = useState(false)
    const [showLowBidConfirmation, setShowLowBidConfirmation] = useState(false)
    const [showUnmarkBidConfirmation, setShowUnmarkBidConfirmation] = useState(false)
    const [bidToUnmark, setBidToUnmark] = useState<string | null>(null)
    const [messMenu, setMessMenu] = useState<MessMenu | null>(null)
    const [loadingMenu, setLoadingMenu] = useState(false)
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        if (id) {
            fetchListing()
            fetchBids()

            // Set up real-time subscriptions for the current listing
            const listingChannel = supabase
                .channel(`listing-${id}`)
                .on('postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'listings',
                        filter: `id=eq.${id}`
                    },
                    (payload) => {
                        fetchListing()
                    }
                )
                .subscribe()

            const bidsChannel = supabase
                .channel(`bids-${id}`)
                .on('postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'bids',
                        filter: `listing_id=eq.${id}`
                    },
                    (payload) => {
                        // Smart handling of bid changes
                        if (payload.eventType === 'INSERT') {
                            // For new bids, just fetch the new bid information
                            fetchBidWithUser(payload.new.id)
                        } else if (payload.eventType === 'UPDATE') {
                            // For bid updates, update the specific bid
                            fetchBidWithUser(payload.new.id)
                        } else {
                            // For deletions or other changes, refresh all bids
                            fetchBids()
                        }
                    }
                )
                .subscribe()

            // Clean up subscriptions on unmount
            return () => {
                supabase.removeChannel(listingChannel)
                supabase.removeChannel(bidsChannel)
            }
        }
    }, [id])

    // Include a real-time listener for listing deletion
    useEffect(() => {
        if (id) {
            // Set up real-time subscription for the current listing
            const listingDeletionChannel = supabase
                .channel(`listing-deleted-${id}`)
                .on('postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'listings',
                        filter: `id=eq.${id}`
                    },
                    (payload) => {
                        // If the user is not the seller or buyer, redirect to listings
                        if (session?.user?.rollNumber) {
                            // Check if this user is the buyer from our session storage
                            const buyerId = typeof window !== 'undefined' ?
                                sessionStorage.getItem(`listing_${id}_buyer`) : null;

                            if (buyerId === session.user.rollNumber) {
                                // Redirect buyer to My Purchases
                                toast.success("The listing has been marked as paid. Redirecting to My Purchases...")
                                router.push("/mess/dashboard?tab=purchases")
                            } else if (session.user.rollNumber === listing?.seller_id) {
                                // Redirect seller to transaction history
                                toast.success("Payment confirmed and transaction completed.")
                                router.push("/mess/dashboard?tab=history")
                            } else {
                                // Redirect anyone else to listings
                                toast.info("This listing has been sold and is no longer available.")
                                router.push("/mess/listings")
                            }
                        } else {
                            // Redirect non-logged in users
                            toast.info("This listing has been sold and is no longer available.")
                            router.push("/mess/listings")
                        }
                    }
                )
                .subscribe()

            // Clean up subscription on unmount
            return () => {
                supabase.removeChannel(listingDeletionChannel)
            }
        }
    }, [id, session, listing, router])

    // Check if current user has an existing bid on this listing
    useEffect(() => {
        if (session?.user?.rollNumber && bids.length > 0) {
            const userBid = bids.find(bid => bid.buyer_roll_number === session.user.rollNumber)
            if (userBid) {
                setUserHasBid(true)
                setUserBidAmount(userBid.bid_price)
                setBidAmount(userBid.bid_price.toString())
            } else {
                setUserHasBid(false)
                setUserBidAmount(0)
            }
        }
    }, [session, bids])

    useEffect(() => {
        if (listing) {
            setNewMinPrice(listing.min_price.toString())

            // Check if the meal is expired
            setIsExpired(isMealExpired(listing.date, listing.meal))
        }
    }, [listing])

    const fetchListing = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("listings")
                .select(`
          *,
          seller:users!listings_seller_id_fkey (
            name,
            email,
            phone_number
          )
        `)
                .eq("id", id)
                .single()

            if (error) {
                throw error
            }

            if (data) {
                setListing(data as unknown as Listing)
            }
        } catch (error) {
            console.error("Error fetching listing:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchBids = async () => {
        try {
            const { data, error } = await supabase
                .from("bids")
                .select(`
                    *
                `)
                .eq("listing_id", id)
                .order("bid_price", { ascending: false })

            if (error) throw error

            // If we have bids, fetch the buyer information separately
            if (data && data.length > 0) {
                const buyerRollNumbers = data.map(bid => bid.buyer_roll_number);

                // Get the buyer information
                const { data: buyersData, error: buyersError } = await supabase
                    .from("users")
                    .select(`
                        roll_number,
                        name,
                        email,
                        phone_number
                    `)
                    .in("roll_number", buyerRollNumbers);

                if (buyersError) throw buyersError;

                // Combine the bid data with the buyer data
                const formattedBids = data.map(bid => {
                    const buyer = buyersData.find(u => u.roll_number === bid.buyer_roll_number);
                    return {
                        ...bid,
                        buyer: buyer || null
                    };
                });

                setBids(formattedBids as unknown as Bid[]);
            } else {
                setBids([]);
            }
        } catch (error) {
            console.error("Error fetching bids:", error)
            toast.error("Failed to load bids")
        }
    }

    // Helper function to fetch a single bid with user information
    const fetchBidWithUser = async (bidId: string) => {
        try {
            // Get the specific bid
            const { data: bidData, error: bidError } = await supabase
                .from("bids")
                .select('*')
                .eq('id', bidId)
                .single()

            if (bidError) {
                console.error("Error fetching specific bid:", bidError)
                return
            }

            // Get the buyer information
            const { data: buyerData, error: buyerError } = await supabase
                .from("users")
                .select(`
                    roll_number,
                    name,
                    email,
                    phone_number
                `)
                .eq("roll_number", bidData.buyer_roll_number)
                .single()

            if (buyerError) {
                console.error("Error fetching buyer info:", buyerError)
                return
            }

            // Create the combined bid object
            const formattedBid = {
                ...bidData,
                buyer: buyerData
            }

            // Update the bids array
            setBids(prevBids => {
                // Check if this bid already exists in our array
                const existingBidIndex = prevBids.findIndex(b => b.id === bidId)

                if (existingBidIndex >= 0) {
                    // Replace the existing bid
                    const newBids = [...prevBids]
                    newBids[existingBidIndex] = formattedBid as unknown as Bid
                    return newBids
                } else {
                    // Add the new bid
                    return [...prevBids, formattedBid as unknown as Bid]
                        .sort((a, b) => b.bid_price - a.bid_price) // Sort by bid price descending
                }
            })

            // Also check if this is the current user's bid
            if (session?.user?.rollNumber && bidData.buyer_roll_number === session.user.rollNumber) {
                setUserHasBid(true)
                setUserBidAmount(bidData.bid_price)
                setBidAmount(bidData.bid_price.toString())
            }
        } catch (error) {
            console.error("Error processing bid update:", error)
        }
    }

    const handleBid = async () => {
        // Haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
        }

        if (!session?.user) {
            toast.error("You must be logged in to place a bid")
            return
        }

        // Check if user has phone number by querying the database
        try {
            const { data, error } = await supabase
                .from('users')
                .select('phone_number')
                .eq('roll_number', session.user.rollNumber)
                .single()

            if (error || !data.phone_number) {
                setShowAuthForm(true)
                return
            }
        } catch (error) {
            console.error("Error checking user phone number:", error)
            setShowAuthForm(true)
            return
        }

        if (!listing) {
            toast.error("Listing details are not available to place a bid.");
            return;
        }

        // Check if the meal has expired
        if (isExpired) {
            toast.error("This meal has already passed and cannot be bid on.");
            return;
        }

        // Validate bid amount
        const bidValue = parseFloat(bidAmount)
        if (isNaN(bidValue) || bidValue < 0) {
            toast.error(`Bid must be a positive amount`)
            return
        }

        // If the bid is lower than the minimum price, ask for confirmation
        if (bidValue < (listing?.min_price || 0)) {
            setShowLowBidConfirmation(true)
            return
        }

        await submitBid(bidValue)
    }

    // Submit the bid regardless of price
    const submitBid = async (bidValue: number) => {
        if (!session?.user || !listing) return

        try {
            setIsSubmitting(true)

            if (userHasBid) {
                // Check if the existing bid is already accepted
                const existingBid = bids.find(b => b.buyer_roll_number === session.user.rollNumber && b.listing_id === id);
                if (existingBid && existingBid.accepted) {
                    toast.error("This bid has already been accepted and cannot be updated.");
                    setIsSubmitting(false);
                    return;
                }

                // Update existing bid
                const { error } = await supabase
                    .from("bids")
                    .update({ bid_price: bidValue })
                    .eq("buyer_roll_number", session.user.rollNumber)
                    .eq("listing_id", id)

                if (error) throw error                // Send notification to the seller about the updated bid
                if (typeof window !== 'undefined') {
                    // Import dynamically to avoid server-side issues
                    const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                    const listingDate = formatDate(listing.date);
                    const notif = notificationMessages.bidUpdated(bidValue, listing.mess, listing.meal, listingDate)

                    await sendNotification(
                        listing.seller_id,
                        'bid_updated',
                        notif.title,
                        notif.message,
                        {
                            listingId: id,
                            buyerId: session.user.rollNumber,
                            price: bidValue,
                            mess: listing.mess,
                            meal: listing.meal
                        }
                    )
                }

                toast.success(`Your bid has been updated to ₹${bidValue}`)
            } else {
                // Create new bid
                const { error } = await supabase
                    .from("bids")
                    .insert({
                        buyer_roll_number: session.user.rollNumber,
                        listing_id: id,
                        bid_price: bidValue
                    })

                if (error) throw error                // Send notification to the seller about the new bid
                if (typeof window !== 'undefined') {
                    // Import dynamically to avoid server-side issues
                    const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                    const listingDate = formatDate(listing.date);
                    const notif = notificationMessages.bidPlaced(bidValue, listing.mess, listing.meal, session.user.name || "A bidder", listingDate)

                    await sendNotification(
                        listing.seller_id,
                        'bid_placed',
                        notif.title,
                        notif.message,
                        {
                            listingId: id,
                            buyerId: session.user.rollNumber,
                            price: bidValue,
                            mess: listing.mess,
                            meal: listing.meal
                        }
                    )
                }

                toast.success(`Your bid of ₹${bidValue} has been placed`)
            }

            // Reset the confirmation dialog
            setShowLowBidConfirmation(false)

            // Refresh bids
            fetchBids()
        } catch (error) {
            console.error("Error placing bid:", error)
            toast.error("Failed to place bid")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Accept a bid for the listing (seller only)
    const acceptBid = async (bidId: string, bidPrice: number, buyerRollNumber: string) => {
        if (!session?.user || session.user.rollNumber !== listing?.seller_id) {
            toast.error("Only the seller can accept bids")
            return
        }

        if (!listing) {
            toast.error("Listing information is missing")
            return
        }

        try {
            setCompletingTransaction(true)

            // Check if any bids are already accepted and unmark them first
            const acceptedBids = bids.filter(bid => bid.accepted && bid.id !== bidId)
            if (acceptedBids.length > 0) {
                for (const acceptedBid of acceptedBids) {
                    const { error: unmarkerror } = await supabase
                        .from("bids")
                        .update({ accepted: false })
                        .eq("id", acceptedBid.id)

                    if (unmarkerror) throw unmarkerror
                }
            }

            // Mark the new bid as accepted
            const { error: bidError } = await supabase
                .from("bids")
                .update({ accepted: true })
                .eq("id", bidId)

            if (bidError) throw bidError

            // Send notification to the buyer
            if (typeof window !== 'undefined') {
                // Import dynamically to avoid server-side issues
                const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                const sellerName = listing.seller.name;
                const sellerPhoneNumber = listing.seller.phone_number || "N/A";
                const listingDate = formatDate(listing.date);

                // Find the buyer data for the notification
                const buyerData = bids.find(b => b.id === bidId)?.buyer;
                const buyerName = buyerData?.name || "Buyer";
                const buyerPhoneNumber = buyerData?.phone_number || "N/A";

                // Send notification to buyer
                const notif = notificationMessages.bidAccepted(bidPrice, listing.mess, listing.meal, sellerName, sellerPhoneNumber, listingDate)
                await sendNotification(
                    buyerRollNumber,
                    'bid_accepted',
                    notif.title,
                    notif.message,
                    {
                        listingId: id,
                        bidId: bidId,
                        sellerId: listing.seller_id,
                        buyerId: buyerRollNumber,
                        price: bidPrice,
                        mess: listing.mess,
                        meal: listing.meal
                    }
                )

                // Also send notification to seller with buyer's contact info
                const sellerNotif = notificationMessages.bidAcceptedSeller(bidPrice, listing.mess, listing.meal, buyerName, buyerPhoneNumber, listingDate)
                await sendNotification(
                    listing.seller_id,
                    'bid_accepted',
                    sellerNotif.title,
                    sellerNotif.message,
                    {
                        listingId: id,
                        bidId: bidId,
                        sellerId: listing.seller_id,
                        buyerId: buyerRollNumber,
                        price: bidPrice,
                        mess: listing.mess,
                        meal: listing.meal
                    }
                )

                // Show toast with buyer's contact info
                if (buyerPhoneNumber !== "N/A") {
                    toast.success(`Bid accepted! Buyer contact: ${buyerPhoneNumber}`)
                } else {
                    toast.success("Bid accepted successfully")
                }
            }

            fetchBids() // Refresh the bids list
        } catch (error) {
            console.error("Error accepting bid:", error)
            toast.error("Failed to accept bid")
        } finally {
            setCompletingTransaction(false)
        }
    }

    // Mark a bid as paid (seller only)
    const markBidAsPaid = async (bidId: string, bidPrice: number, buyerRollNumber: string) => {
        // Haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
        }

        if (!session?.user || session.user.rollNumber !== listing?.seller_id) {
            toast.error("Only the seller can mark a bid as paid")
            return
        }

        if (!listing) {
            toast.error("Listing information is missing")
            return
        }

        try {
            setCompletingTransaction(true)

            // Mark the bid as paid
            const { error: bidError } = await supabase
                .from("bids")
                .update({ paid: true })
                .eq("id", bidId)

            if (bidError) throw bidError

            // Create transaction history entry
            const { data: txData, error: txError } = await supabase
                .from("transaction_history")
                .insert({
                    date_of_transaction: new Date().toISOString().split('T')[0],
                    meal: listing.meal,
                    mess: listing.mess,
                    sold_price: bidPrice,
                    listing_price: listing.min_price,
                    buyer_id: buyerRollNumber,
                    seller_id: listing.seller_id,
                    listing_created_at: listing.created_at,
                    sold_time: new Date().toISOString()
                })
                .select('id')
                .single()

            if (txError) throw txError

            // Fetch the seller's token using their API key
            const tokenResponse = await fetch(`/api/user-token?userId=${listing.seller_id}`);

            if (!tokenResponse.ok) {
                console.error("Failed to fetch seller token:", await tokenResponse.json());
                // Continue with the process even if token fetch fails
            } else {
                const tokenData = await tokenResponse.json();
                const sellerToken = tokenData.token;

                if (sellerToken) {
                    // Create record in the purchases table with meal date from the listing
                    // The purchase record will be used to display in My Purchases section until the meal date passes
                    // The transaction_id is a foreign key to the transaction_history table
                    const { error: purchaseError } = await supabase
                        .from("purchases")
                        .insert({
                            transaction_id: txData.id,
                            seller_token: sellerToken,
                            meal_date: new Date(listing.date).toISOString().split('T')[0]
                        });

                    if (purchaseError) {
                        console.error("Error creating purchase record:", purchaseError);
                        // Continue with the process even if purchase creation fails
                    }
                }
            }

            // Send notification to the buyer
            if (typeof window !== 'undefined') {
                // Import dynamically to avoid server-side issues
                const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                const sellerName = listing.seller.name;
                const listingDate = formatDate(listing.date);
                const buyerNotif = notificationMessages.paymentMarked(bidPrice, listing.mess, listing.meal, sellerName, listingDate)
                await sendNotification(
                    buyerRollNumber,
                    'payment_marked',
                    buyerNotif.title,
                    buyerNotif.message,
                    {
                        listingId: id,
                        bidId: bidId,
                        sellerId: listing.seller_id,
                        buyerId: buyerRollNumber,
                        price: bidPrice,
                        mess: listing.mess,
                        meal: listing.meal
                    }
                )

                // Also notify the seller (self-notification for record keeping)
                const sellerNotif = notificationMessages.paymentReceived(bidPrice, listing.mess, listing.meal, listingDate)
                await sendNotification(
                    listing.seller_id,
                    'payment_marked', // Should this be 'payment_received' type? The message is paymentReceived.
                    sellerNotif.title,
                    sellerNotif.message,
                    {
                        listingId: id,
                        bidId: bidId,
                        sellerId: listing.seller_id,
                        buyerId: buyerRollNumber,
                        price: bidPrice,
                        mess: listing.mess,
                        meal: listing.meal
                    }
                )
            }

            // Store the buyer information for listener identification
            // We'll use session storage instead of updating a non-existent column
            if (typeof window !== 'undefined') {
                // Store the buyer ID temporarily to help the real-time listener identify the buyer
                sessionStorage.setItem(`listing_${id}_buyer`, buyerRollNumber);
            }

            // Delete all bids for this listing
            const { error: deleteBidsError } = await supabase
                .from("bids")
                .delete()
                .eq("listing_id", id)

            if (deleteBidsError) throw deleteBidsError

            // Delete the listing
            const { error: deleteListingError } = await supabase
                .from("listings")
                .delete()
                .eq("id", id)

            if (deleteListingError) throw deleteListingError

            toast.success("Payment confirmed and transaction completed successfully")

            // Redirect to dashboard with appropriate tab
            if (session?.user?.rollNumber === listing.seller_id) {
                // Seller is redirected to the history tab
                router.push("/mess/dashboard?tab=history")
            } else if (session?.user?.rollNumber === buyerRollNumber) {
                // Buyer is redirected to the purchases tab
                router.push("/mess/dashboard?tab=purchases")
            }
        } catch (error) {
            console.error("Error marking bid as paid:", error)
            toast.error("Failed to mark bid as paid")
        } finally {
            setCompletingTransaction(false)
        }
    }

    // Unmark a bid as accepted and delete it (seller only)
    const unmarkBid = async () => {
        if (!bidToUnmark) return;

        if (!session?.user || session.user.rollNumber !== listing?.seller_id) {
            toast.error("Only the seller can manage accepted bids")
            return
        }

        if (!listing) {
            toast.error("Listing information is missing")
            return
        }

        try {
            setCompletingTransaction(true)

            // Get the bid details before deleting it
            const bidToRemove = bids.find(bid => bid.id === bidToUnmark);
            if (!bidToRemove) {
                throw new Error("Bid not found");
            }

            const buyerRollNumber = bidToRemove.buyer_roll_number;
            const bidPrice = bidToRemove.bid_price;

            // Delete the bid directly instead of unmarking it
            const { error: deleteError } = await supabase
                .from("bids")
                .delete()
                .eq("id", bidToUnmark)

            if (deleteError) throw deleteError

            // Send notification to the buyer about the bid cancellation
            if (typeof window !== 'undefined') {
                // Import dynamically to avoid server-side issues
                const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                const sellerName = listing.seller.name;
                const listingDate = formatDate(listing.date);

                // Use the proper notification message from notificationMessages
                const notif = notificationMessages.bidCancelled(bidPrice, listing.mess, listing.meal, sellerName, listingDate);

                await sendNotification(
                    buyerRollNumber,
                    'bid_cancelled',
                    notif.title,
                    notif.message,
                    {
                        listingId: id,
                        bidId: bidToUnmark,
                        sellerId: listing.seller_id,
                        buyerId: buyerRollNumber,
                        price: bidPrice,
                        mess: listing.mess,
                        meal: listing.meal
                    }
                )
            }

            // Clear the confirmation dialog
            setShowUnmarkBidConfirmation(false)
            setBidToUnmark(null)

            toast.success(`Bid cancelled for ${listing.meal} at ${listing.mess} successfully`)
            fetchBids() // Refresh the bids list
        } catch (error) {
            console.error("Error deleting bid:", error)
            toast.error("Failed to cancel and delete bid")
        } finally {
            setCompletingTransaction(false)
        }
    }

    // Update the minimum price (seller only)
    const updateMinPrice = async () => {
        if (!session?.user || session.user.rollNumber !== listing?.seller_id) {
            toast.error("Only the seller can update the minimum price")
            return
        }

        if (!listing) {
            toast.error("Listing information is missing")
            return
        }

        const minPriceValue = parseFloat(newMinPrice)
        if (isNaN(minPriceValue) || minPriceValue < 0) {
            toast.error("Please enter a valid price (0 or greater)")
            return
        }

        try {
            setUpdatingPrice(true)

            // Update the listing with the new minimum price
            const { error } = await supabase
                .from("listings")
                .update({ min_price: minPriceValue })
                .eq("id", id)

            if (error) throw error

            toast.success(`Minimum price updated to ₹${minPriceValue}`)

            // Update local state
            setListing(prev => prev ? { ...prev, min_price: minPriceValue } : null)
            setEditMinPrice(false)
        } catch (error) {
            console.error("Error updating minimum price:", error)
            toast.error("Failed to update minimum price")
        } finally {
            setUpdatingPrice(false)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    const handleShare = async () => {
        if (!listing) return

        const shareText = `[SELL] ${listing.mess} ${listing.meal}\n${formatDate(listing.date)}\n₹${listing.min_price}`

        // Open WhatsApp directly with the message
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${window.location.href}`)}`

        // Open WhatsApp in a new tab
        window.open(whatsappUrl, '_blank')
        toast.success('Opening WhatsApp to share listing')
    }

    // Function to fetch mess menu
    const fetchMessMenu = async () => {
        if (!listing || !session?.user) return

        try {
            setLoadingMenu(true)
            // Convert mess name to lowercase and validate it
            const messName = listing.mess.toLowerCase()
            // Check if mess name is valid
            if (!['north', 'south', 'yuktahar', 'kadamba'].includes(messName)) {
                console.error(`Invalid mess name: ${messName}`)
                return
            }

            const response = await fetch(`/api/mess-menu?mess=${messName}&userId=${session.user.rollNumber}`)

            if (!response.ok) {
                throw new Error(`Failed to fetch menu: ${response.status}`)
            }

            const data = await response.json()
            setMessMenu(data.data)
        } catch (error) {
            console.error("Error fetching mess menu:", error)
            // Don't show error toast as this is not critical
        } finally {
            setLoadingMenu(false)
        }
    }

    // Fetch mess menu when listing is loaded
    useEffect(() => {
        if (listing) {
            fetchMessMenu()
        }
    }, [listing])

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-2 mb-6">
                <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => router.back()}
                    className="flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                </Button>
            </div>

            <PageHeading
                title="Listing Details"
                subtitle={session?.user?.rollNumber === listing?.seller_id
                    ? "Someday you'll find the one (buyer)"
                    : "Bid higher, it always works"
                }
            />

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <p>Loading listing details...</p>
                </div>
            ) : listing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Main listing details card */}
                    <Card className="md:col-span-1">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div className="flex items-center gap-3">
                                <MessIcon messName={listing.mess} size={32} />
                                <div>
                                    <h2 className="text-xl font-bold">{listing.mess}</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Posted {format(new Date(listing.created_at), 'PPp')}
                                    </p>
                                </div>
                            </div>
                            {session?.user?.rollNumber === listing.seller_id && editMinPrice ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={newMinPrice}
                                        onChange={(e) => setNewMinPrice(e.target.value)}
                                        className="w-24"
                                    />
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            size="sm"
                                            onClick={updateMinPrice}
                                            disabled={updatingPrice}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            variant="neutral"
                                            size="sm"
                                            onClick={() => {
                                                setEditMinPrice(false);
                                                setNewMinPrice(listing.min_price.toString());
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold">
                                        ₹{listing.min_price}
                                    </span>
                                    {session?.user?.rollNumber === listing.seller_id && (
                                        <Button
                                            variant="neutral"
                                            size="sm"
                                            onClick={() => setEditMinPrice(true)}
                                            className="ml-1"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardHeader>

                        <CardContent className="">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xl">{listing.meal}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xl">{formatDate(listing.date)}</span>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <span>{listing.seller.name}</span>
                                </div>

                                {/* Show expired warning if applicable */}
                                {isExpired && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                                        <p className="text-yellow-700 text-sm">
                                            This meal has already passed and the listing will be automatically removed soon.
                                        </p>
                                    </div>
                                )}

                                {/* Mess Menu Section */}
                                <div className="border-t pt-4 mt-4">
                                    <h3 className="text-lg font-semibold mb-2">Menu for This Meal</h3>

                                    {loadingMenu ? (
                                        <p className="text-sm text-muted-foreground">Loading menu...</p>
                                    ) : messMenu ? (
                                        <div className="space-y-2">
                                            {/* Get the menu for the day of the week that matches the listing's date */}
                                            {(() => {
                                                const listingDate = new Date(listing.date);
                                                const dayOfWeek = dayNames[listingDate.getDay()];
                                                const dayMenu = messMenu.days[dayOfWeek];

                                                if (!dayMenu) {
                                                    return <p className="text-sm text-muted-foreground">No menu available for this day</p>;
                                                }

                                                const mealItems = dayMenu[listing.meal.toLowerCase() as keyof typeof dayMenu];

                                                if (!mealItems || mealItems.length === 0) {
                                                    return <p className="text-sm text-muted-foreground">No menu available for {listing.meal}</p>;
                                                }

                                                return (
                                                    <div className="grid grid-cols-1 gap-1">
                                                        {mealItems.map((item, index) => (
                                                            <div key={index} className="text-sm">
                                                                {item.item ? (
                                                                    <>
                                                                        <span className="font-medium">{item.category}:</span> {item.item}
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Menu information unavailable</p>
                                    )}
                                </div>

                                {session?.user && session.user.rollNumber !== listing.seller_id && !isExpired && (
                                    <div className="border-t pt-4 mt-4">
                                        <h3 className="text-lg font-medium">Place a Bid</h3>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={bidAmount}
                                                onChange={(e) => setBidAmount(e.target.value)}
                                                placeholder={`Suggested minimum: ₹${listing.min_price}`}
                                                className="w-full"
                                            />
                                            <Button
                                                onClick={handleBid}
                                                disabled={parseFloat(bidAmount) < 0 || isSubmitting}
                                            >
                                                Bid
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {!session?.user && (
                                    <div className="border-t pt-4 mt-4">
                                        <p className="text-center text-muted-foreground">
                                            Please sign in to contact the seller or place a bid.
                                        </p>
                                    </div>
                                )}

                                {session?.user?.rollNumber === listing.seller_id && (
                                    <div className="border-t pt-4 mt-4 flex justify-end">
                                        <Button
                                            variant="neutral"
                                            size="sm"
                                            onClick={handleShare}
                                            className="flex items-center gap-1"
                                        >
                                            <Share2 className="h-4 w-4 mr-1" />
                                            Share
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Display bids section */}
                    {bids && bids.length > 0 && !bids.some(bid => bid.paid) && (
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold">Bids ({bids.length})</CardTitle>
                            </CardHeader>
                            <CardContent className={`${bids.length > 0 ? "p-0 divide-y" : "p-4"}`}>
                                {bids.length > 0 ? (
                                    bids.map((bid) => (
                                        <div key={bid.id} className={`p-4 flex flex-col sm:flex-row justify-between ${bid.accepted ? "bg-emerald-50" : ""}`}>
                                            <div className="mb-3 sm:mb-0">
                                                <p className="font-medium">{bid.buyer?.name}</p>
                                                <p className="text-xl font-bold">
                                                    {new Intl.NumberFormat('en-IN', {
                                                        style: 'currency',
                                                        currency: 'INR',
                                                        minimumFractionDigits: 0,
                                                    }).format(bid.bid_price)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Bid placed on {format(new Date(bid.created_at), 'do MMMM')} at {new Date(bid.created_at).toLocaleTimeString()}
                                                </p>
                                                {bid.accepted && (
                                                    <div className="mt-1 flex items-center">
                                                        <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                            Accepted Bid
                                                        </span>
                                                    </div>
                                                )}
                                                {bid.accepted && bid.buyer?.phone_number && session?.user?.rollNumber === listing.seller_id && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                                        <p className="text-xs">{bid.buyer.phone_number}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {session?.user?.rollNumber === listing.seller_id && (
                                                <div className="flex flex-wrap gap-2">
                                                    {bid.accepted ? (
                                                        <>
                                                            <Button
                                                                onClick={() => markBidAsPaid(bid.id, bid.bid_price, bid.buyer_roll_number)}
                                                                variant="noShadow"
                                                                size="sm"
                                                                className="bg-emerald-100 border-emerald-800 text-emerald-800 w-full sm:w-auto"
                                                                disabled={bid.paid || completingTransaction}
                                                            >
                                                                {bid.paid ? "Paid" : "Mark as Paid"}
                                                            </Button>
                                                            <Button
                                                                onClick={() => {
                                                                    setBidToUnmark(bid.id);
                                                                    setShowUnmarkBidConfirmation(true);
                                                                }}
                                                                variant="neutral"
                                                                size="sm"
                                                                className="w-full sm:w-auto"
                                                                disabled={completingTransaction}
                                                            >
                                                                Cancel Bid
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            onClick={() => acceptBid(bid.id, bid.bid_price, bid.buyer_roll_number)}
                                                            size="sm"
                                                            className="w-full sm:w-auto"
                                                            disabled={completingTransaction || bids.some(b => b.accepted)}
                                                            title={bids.some(b => b.accepted) ? "Another bid is already accepted" : "Accept this bid"}
                                                        >
                                                            {bids.some(b => b.accepted) ? "Another Bid Accepted" : "Accept Bid"}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )))
                                    : (
                                        <p className="text-center text-muted-foreground">
                                            When people start bidding they will show up here.
                                        </p>
                                    )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="mb-4">This listing doesn't exist or has been removed.</p>
                    <Button onClick={() => router.push('/mess/listings')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Listings
                    </Button>
                </div>
            )}

            {/* Auth form for users without phone/API key */}
            <UserAuthForm
                isOpen={showAuthForm}
                onClose={() => setShowAuthForm(false)}
                requireApiKey={false} // Don't require API key for buyers placing bids
            />

            {/* Confirmation dialog for bidding below minimum price */}
            <Dialog open={showLowBidConfirmation} onOpenChange={setShowLowBidConfirmation}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            <DialogTitle>Bid Below Suggested Price</DialogTitle>
                        </div>
                        <DialogDescription>
                            You are about to place a bid below the seller's suggested minimum price of ₹{listing?.min_price}.
                            Are you sure you want to continue?
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">
                        The seller may be less likely to accept bids below their suggested minimum price.
                    </p>
                    <DialogFooter>
                        <Button
                            variant="neutral"
                            onClick={() => setShowLowBidConfirmation(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => submitBid(parseFloat(bidAmount))}
                            disabled={isSubmitting}
                        >
                            Yes, Place Bid
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation dialog for unmarking an accepted bid */}
            <Dialog open={showUnmarkBidConfirmation} onOpenChange={setShowUnmarkBidConfirmation}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            <DialogTitle>Cancel Accepted Bid</DialogTitle>
                        </div>
                        <DialogDescription>
                            Are you sure you want to cancel this accepted bid? This will delete the bid and notify the buyer that they no longer need to make payment.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="neutral"
                            onClick={() => {
                                setShowUnmarkBidConfirmation(false);
                                setBidToUnmark(null);
                            }}
                        >
                            No, Keep Bid
                        </Button>
                        <Button
                            onClick={unmarkBid}
                            disabled={completingTransaction}
                        >
                            Yes, Cancel Bid
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
