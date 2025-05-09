"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { format } from "date-fns"
import { CalendarDays, Clock, User, Phone, AlertCircle, ArrowLeft } from "lucide-react"

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import UserAuthForm from "@/components/auth/UserAuthForm"

interface Listing {
    id: string
    min_price: number
    date: string
    meal: string
    mess: string
    seller_id: string
    created_at: string
    buyer_id?: string  // Add this optional property
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

    useEffect(() => {
        if (id) {
            fetchListing()
            fetchBids()
        }
    }, [id])

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
            toast.error("Failed to load listing details")
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

    const handleBid = async () => {
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

        // Validate bid amount
        const bidValue = parseFloat(bidAmount)
        if (isNaN(bidValue) || bidValue < (listing?.min_price || 0)) {
            toast.error(`Bid must be at least ₹${listing?.min_price}`)
            return
        }

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

                if (error) throw error

                // Send notification to the seller about the updated bid
                if (typeof window !== 'undefined') {
                    // Import dynamically to avoid server-side issues
                    const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                    const notif = notificationMessages.bidUpdated(bidValue, listing.mess, listing.meal)

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

                if (error) throw error

                // Send notification to the seller about the new bid
                if (typeof window !== 'undefined') {
                    // Import dynamically to avoid server-side issues
                    const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                    const notif = notificationMessages.bidPlaced(bidValue, listing.mess, listing.meal, session.user.name || "A bidder")

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
            // Mark the bid as accepted
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
                const notif = notificationMessages.bidAccepted(bidPrice, listing.mess, listing.meal, sellerName, sellerPhoneNumber)

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
            }

            toast.success("Bid accepted successfully")
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
            const { error: txError } = await supabase
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

            if (txError) throw txError

            // Send notification to the buyer
            if (typeof window !== 'undefined') {
                // Import dynamically to avoid server-side issues
                const { sendNotification, notificationMessages } = await import('@/lib/notifications')

                const sellerName = listing.seller.name;
                const buyerNotif = notificationMessages.paymentMarked(bidPrice, listing.mess, listing.meal, sellerName)
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
                const sellerNotif = notificationMessages.paymentReceived(bidPrice, listing.mess, listing.meal)
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
            // Redirect to dashboard since this listing is now deleted
            router.push("/mess/dashboard")
        } catch (error) {
            console.error("Error marking bid as paid:", error)
            toast.error("Failed to mark bid as paid")
        } finally {
            setCompletingTransaction(false)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center h-64">
                    <p>Loading listing details...</p>
                </div>
            </div>
        )
    }

    if (!listing) {
        return (
            <div className="container mx-auto px-4 py-8">
                <PageHeading title="Listing Not Found" />
                <div className="flex flex-col items-center justify-center h-64">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="mb-4">This listing doesn't exist or has been removed.</p>
                    <Button onClick={() => router.push('/mess/listings')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Listings
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Button
                    variant="noShadow"
                    onClick={() => router.push('/mess/listings')}
                    className="mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Listings
                </Button>

                <PageHeading title={`${listing.mess} ${listing.meal}`} />
            </div>

            <div className="max-w-2xl mx-auto">
                <Card className="mb-8 overflow-hidden">
                    <CardHeader className="bg-main-foreground/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessIcon messName={listing.mess} size={24} />
                                <CardTitle className="text-3xl font-bold">{listing.mess}</CardTitle>
                            </div>
                            <span className="text-2xl font-bold">
                                ₹{listing.min_price}
                            </span>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xl">{listing.meal}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xl">{formatDate(listing.date)}</span>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-lg font-medium mb-2">Seller Information</h3>
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span>{listing.seller.name}</span>
                                </div>

                                {session?.user && listing.seller.phone_number && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{listing.seller.phone_number}</span>
                                    </div>
                                )}
                            </div>

                            {session?.user && session.user.rollNumber !== listing.seller_id && (
                                <div className="border-t pt-4 mt-4">
                                    <h3 className="text-lg font-medium mb-2">Place a Bid</h3>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={listing.min_price}
                                            value={bidAmount}
                                            onChange={(e) => setBidAmount(e.target.value)}
                                            placeholder={`Minimum ₹${listing.min_price}`}
                                            className="w-full"
                                        />
                                        <Button
                                            onClick={handleBid}
                                            disabled={!bidAmount || isSubmitting || parseFloat(bidAmount) < listing.min_price}
                                        >
                                            Bid
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Enter an amount greater than or equal to the minimum price.
                                    </p>
                                </div>
                            )}

                            {session?.user?.rollNumber === listing.seller_id && (
                                <div className="bg-secondary-background/30 p-4 rounded-md mt-4">
                                    <p className="text-center text-muted-foreground">
                                        This is your own listing.
                                    </p>
                                </div>
                            )}

                            {!session?.user && (
                                <div className="border-t pt-4 mt-4">
                                    <p className="text-center text-muted-foreground">
                                        Please sign in to contact the seller or place a bid.
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="bg-main-foreground/5 p-4">
                        <p className="text-sm text-muted-foreground">
                            Listed on {new Date(listing.created_at).toLocaleDateString()} at {new Date(listing.created_at).toLocaleTimeString()}
                        </p>
                    </CardFooter>
                </Card>

                {/* Display bids section (visible to the seller only) */}
                {session?.user?.rollNumber === listing.seller_id && !listing.buyer_id && bids.length > 0 && (
                    <Card className="mb-8 overflow-hidden">
                        <CardHeader className="bg-main-foreground/5">
                            <CardTitle className="text-xl font-bold">Bids ({bids.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 divide-y">
                            {bids.map((bid) => (
                                <div key={bid.id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{bid.buyer?.name}</p>
                                        <p className="text-xl font-bold">
                                            {new Intl.NumberFormat('en-IN', {
                                                style: 'currency',
                                                currency: 'INR',
                                                minimumFractionDigits: 0,
                                            }).format(bid.bid_price)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Bid placed on {new Date(bid.created_at).toLocaleDateString()} at {new Date(bid.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {bid.accepted ? (
                                            <Button
                                                onClick={() => markBidAsPaid(bid.id, bid.bid_price, bid.buyer_roll_number)}
                                                variant="noShadow"
                                                className="bg-emerald-100 border-emerald-800 text-emerald-800"
                                                disabled={bid.paid || completingTransaction}
                                            >
                                                {bid.paid ? "Paid" : "Mark as Paid"}
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => acceptBid(bid.id, bid.bid_price, bid.buyer_roll_number)}
                                                disabled={completingTransaction}
                                            >
                                                Accept Bid
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Auth form for users without phone/API key */}
            <UserAuthForm
                isOpen={showAuthForm}
                onClose={() => setShowAuthForm(false)}
                requireApiKey={false} // Don't require API key for buyers placing bids
            />
        </div>
    )
}