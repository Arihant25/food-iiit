"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import { CalendarDays, ShoppingBag, ReceiptText, TagIcon, Phone, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatRelativeTime } from "@/lib/utils"
import QRCode from 'react-qr-code'

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionsTable } from "@/components/transactions/transaction-table"

interface Listing {
    id: string
    min_price: number
    final_price?: number
    date: string
    meal: string
    mess: string
    seller_id: string
    created_at: string
    seller_name?: string
    buyer_name?: string
    bids?: bid[]
    transaction?: boolean
}

interface Purchase {
    id: string
    transaction_id: string
    seller_token: string
    meal_date: string
    created_at: string
    transaction?: {
        id: string
        date_of_transaction: string
        meal: string
        mess: string
        sold_price: number
        listing_price: number
        buyer_id: string
        seller_id: string
        seller?: {
            name: string
        }
    }
}

interface bid {
    id: string
    buyer_roll_number: string
    listing_id: string
    bid_price: number
    created_at: string
    accepted: boolean
    paid: boolean
    buyer_name?: string
    buyer_phone?: string | null
    seller_name?: string
    listing?: any
}

interface Transaction {
    id: string
    date_of_transaction: string
    meal: string
    mess: string
    sold_price: number
    listing_price: number
    buyer_id: string
    seller_id: string
    listing_created_at: string
    sold_time: string
    time_gap: string
    buyer_name?: string
    seller_name?: string
}

function Dashboard() {
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [soldListings, setSoldListings] = useState<Listing[]>([])
    const [purchasedListings, setPurchasedListings] = useState<Listing[]>([])
    const [myBids, setMyBids] = useState<bid[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [myPurchases, setMyPurchases] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(() => {
        // Get the tab query parameter, default to "sold" if not present
        const tabParam = searchParams.get("tab")
        return tabParam && ["sold", "purchased", "bids", "history"].includes(tabParam) ? tabParam : "sold"
    })

    useEffect(() => {
        if (session?.user?.rollNumber) {
            fetchUserListings()
            fetchUserBids()
            fetchTransactionHistory()
            fetchMyPurchases()
            setupRealTimeSubscriptions()
        }

        return () => {
            // Clean up subscriptions on unmount
            supabase.removeAllChannels()
        }
    }, [session])

    // Set up real-time subscriptions
    const setupRealTimeSubscriptions = () => {
        if (!session?.user?.rollNumber) return

        // Subscribe to all bids on user's listings
        const bidsChannel = supabase
            .channel('dashboard-bids')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bids',
                },
                (payload) => {
                    // Fetch user bids and listings to ensure data is up-to-date
                    fetchUserBids()
                    fetchUserListings()
                }
            )
            .subscribe()

        // Subscribe to new listings
        const listingsChannel = supabase
            .channel('dashboard-listings')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'listings',
                },
                (payload) => {
                    fetchUserListings()
                }
            )
            .subscribe()

        // Subscribe to transactions
        const transactionsChannel = supabase
            .channel('dashboard-transactions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transaction_history',
                },
                (payload) => {
                    fetchTransactionHistory()
                    fetchUserListings()
                    fetchUserBids()
                }
            )
            .subscribe()

        // Subscribe to purchases
        const purchasesChannel = supabase
            .channel('dashboard-purchases')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'purchases',
                },
                (payload) => {
                    fetchMyPurchases()
                }
            )
            .subscribe()
    }

    // Helper function to get listing IDs for subscription filter
    const getListingIdsFilter = () => {
        if (!soldListings || soldListings.length === 0) {
            // Return a dummy ID that won't match any real records 
            // to avoid query errors when no listings exist
            return '00000000-0000-0000-0000-000000000000'
        }
        return soldListings.map(listing => `"${listing.id}"`).join(',')
    }

    // Fetch both listings sold by user and bought by user
    const fetchUserListings = async () => {
        if (!session?.user?.rollNumber) return

        try {
            setLoading(true)

            // Fetch listings sold by the user
            const { data: soldData, error: soldError } = await supabase
                .from("listings")
                .select(`
                    *,
                    seller:seller_id (name)
                `)
                .eq("seller_id", session.user.rollNumber)
                .order("created_at", { ascending: false })

            if (soldError) throw soldError

            // Fetch bids for each listing
            const formattedSoldListings = await Promise.all(soldData.map(async (item) => {
                const { data: bids, error: bidsError } = await supabase
                    .from("bids")
                    .select(`
                        *,
                        buyer:buyer_roll_number (
                            name,
                            phone_number
                        )
                    `)
                    .eq("listing_id", item.id)
                    .order("bid_price", { ascending: false })

                if (bidsError) console.error("Error fetching bids:", bidsError)

                const formattedBids = bids ? bids.map(bid => ({
                    ...bid,
                    buyer_name: bid.buyer ? bid.buyer.name : "Unknown Buyer",
                    buyer_phone: bid.buyer ? bid.buyer.phone_number : null
                })) : []

                return {
                    ...item,
                    seller_name: item.seller ? item.seller.name : "Unknown",
                    bids: formattedBids
                }
            }))

            setSoldListings(formattedSoldListings)

            // For purchased listings, we need to look at the transaction history
            const { data: purchasedData, error: purchasedError } = await supabase
                .from("transaction_history")
                .select(`
                    *,
                    seller:seller_id (name)
                `)
                .eq("buyer_id", session.user.rollNumber)
                .order("sold_time", { ascending: false })

            if (purchasedError) throw purchasedError

            // Format transaction history as listings for display
            const formattedPurchasedListings = purchasedData.map(item => ({
                id: item.id,
                min_price: item.listing_price,
                final_price: item.sold_price,
                date: item.date_of_transaction,
                meal: item.meal,
                mess: item.mess,
                seller_id: item.seller_id,
                created_at: item.listing_created_at,
                seller_name: item.seller ? item.seller.name : "Unknown",
                transaction: true // Flag to identify this as a transaction record
            }))

            setPurchasedListings(formattedPurchasedListings)
        } catch (error) {
            console.error("Error fetching listings:", error)
            toast.error("Failed to load your listings")
        } finally {
            setLoading(false)
        }
    }

    // Fetch all bids placed by the user
    const fetchUserBids = async () => {
        if (!session?.user?.rollNumber) return

        try {
            // First, get the bids
            const { data: bidsData, error: bidsError } = await supabase
                .from("bids")
                .select(`
                    *
                `)
                .eq("buyer_roll_number", session.user.rollNumber)
                .order("created_at", { ascending: false })

            if (bidsError) throw bidsError

            // If we have bids, fetch the associated listings separately
            if (bidsData && bidsData.length > 0) {
                const listingIds = bidsData.map(bid => bid.listing_id)

                // Get the listings information
                const { data: listingsData, error: listingsError } = await supabase
                    .from("listings")
                    .select(`
                        *,
                        seller:seller_id (name)
                    `)
                    .in("id", listingIds)

                if (listingsError) throw listingsError

                // Combine the bid data with the listing data
                const formattedBids = bidsData.map(bid => {
                    const listing = listingsData.find(l => l.id === bid.listing_id)
                    return {
                        ...bid,
                        listing: listing || {},
                        seller_name: listing?.seller?.name || "Unknown Seller"
                    }
                })

                setMyBids(formattedBids)
            } else {
                setMyBids([])
            }
        } catch (error) {
            console.error("Error fetching bids:", error)
            toast.error("Failed to load your bids")
        }
    }

    // Fetch transaction history
    const fetchTransactionHistory = async () => {
        if (!session?.user?.rollNumber) return

        try {
            // Fetch transactions where user is either buyer or seller
            const { data, error } = await supabase
                .from("transaction_history")
                .select(`
                    *,
                    buyer:buyer_id (name),
                    seller:seller_id (name)
                `)
                .or(`buyer_id.eq.${session.user.rollNumber},seller_id.eq.${session.user.rollNumber}`)
                .order("sold_time", { ascending: false })

            if (error) throw error

            const formattedTransactions = data.map(tx => ({
                ...tx,
                buyer_name: tx.buyer ? tx.buyer.name : "Unknown Buyer",
                seller_name: tx.seller ? tx.seller.name : "Unknown Seller"
            }))

            setTransactions(formattedTransactions)
        } catch (error) {
            console.error("Error fetching transaction history:", error)
            toast.error("Failed to load transaction history")
        }
    }    // Fetch the user's active purchases (purchases that haven't expired)
    // Purchases are considered "active" when the meal_date is today or in the future
    // Once the meal_date passes, purchases won't show up in the My Purchases section anymore
    const fetchMyPurchases = async () => {
        if (!session?.user?.rollNumber) return;

        try {
            // Get current date
            const today = new Date().toISOString().split('T')[0];

            // Fetch purchases where the user is the buyer and meal date is today or in the future
            // Use the specific foreign key name to avoid ambiguity
            const { data, error } = await supabase
                .from("purchases")
                .select(`
                    *,
                    transaction:transaction_history!purchases_transaction_id_fkey (
                        *,
                        seller:seller_id (name)
                    )
                `)
                .gte('meal_date', today)
                .order('meal_date', { ascending: true });

            if (error) throw error;

            if (data) {
                // Now get just purchases where the current user is the buyer
                const userPurchases = data.filter(purchase =>
                    purchase.transaction?.buyer_id === session.user.rollNumber
                );

                setMyPurchases(userPurchases);
            }
        } catch (error) {
            console.error("Error fetching purchases:", error);
            toast.error("Failed to load your purchases");
        }
    };

    // Accept a bid for a listing
    const acceptBid = async (listingId: string, bidId: string, bidPrice: number, buyerRollNumber: string) => {
        try {
            // Mark the bid as accepted
            const { error: bidError } = await supabase
                .from("bids")
                .update({ accepted: true })
                .eq("id", bidId)

            if (bidError) throw bidError

            // Get the listing details for transaction creation
            const { data: listingData, error: listingGetError } = await supabase
                .from("listings")
                .select("*")
                .eq("id", listingId)
                .single()

            if (listingGetError) throw listingGetError

            // Create transaction history entry immediately
            const { error: txError } = await supabase
                .from("transaction_history")
                .insert({
                    date_of_transaction: new Date().toISOString().split('T')[0],
                    meal: listingData.meal,
                    mess: listingData.mess,
                    sold_price: bidPrice,
                    listing_price: listingData.min_price,
                    buyer_id: buyerRollNumber,
                    seller_id: listingData.seller_id,
                    listing_created_at: listingData.created_at,
                    sold_time: new Date().toISOString()
                })

            if (txError) throw txError

            // Delete all bids for this listing
            const { error: deleteBidsError } = await supabase
                .from("bids")
                .delete()
                .eq("listing_id", listingId)

            if (deleteBidsError) throw deleteBidsError

            // Delete the listing
            const { error: deleteListingError } = await supabase
                .from("listings")
                .delete()
                .eq("id", listingId)

            if (deleteListingError) throw deleteListingError

            toast.success("Bid accepted and transaction completed successfully")
            fetchUserListings()
            fetchTransactionHistory()
        } catch (error) {
            console.error("Error accepting bid:", error)
            toast.error("Failed to accept bid")
        }
    }

    // Place a bid on a listing
    const placeBid = async (listingId: string, bidPrice: number) => {
        if (!session?.user?.rollNumber) {
            toast.error("You must be logged in to place a bid")
            return
        }

        try {
            const { error } = await supabase
                .from("bids")
                .insert({
                    buyer_roll_number: session.user.rollNumber,
                    listing_id: listingId,
                    bid_price: bidPrice
                })

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    toast.error("You've already placed a bid on this listing. Update your existing bid instead.")
                } else {
                    throw error
                }
            } else {
                toast.success("Bid placed successfully")
                fetchUserBids()
            }
        } catch (error) {
            console.error("Error placing bid:", error)
            toast.error("Failed to place bid")
        }
    }

    // Format date to show "28th May (Tue)"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    // Format price to INR
    const formatPrice = (price: number | undefined) => {
        if (price === undefined) return "₹0";
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(price)
    }

    // Delete a listing
    const deleteListing = async (e: React.MouseEvent, listingId: string) => {
        e.stopPropagation(); // Prevent navigating to listing detail page

        if (!window.confirm("Are you sure you want to delete this listing?")) {
            return;
        }

        try {
            // Delete all bids for this listing first
            const { error: deleteBidsError } = await supabase
                .from("bids")
                .delete()
                .eq("listing_id", listingId);

            if (deleteBidsError) throw deleteBidsError;

            // Delete the listing
            const { error: deleteListingError } = await supabase
                .from("listings")
                .delete()
                .eq("id", listingId);

            if (deleteListingError) throw deleteListingError;

            toast.success("Listing deleted successfully");
            fetchUserListings();
        } catch (error) {
            console.error("Error deleting listing:", error);
            toast.error("Failed to delete listing");
        }
    };

    // Delete a bid
    const deleteBid = async (e: React.MouseEvent, bidId: string) => {
        e.stopPropagation(); // Prevent navigating to listing detail page

        if (!window.confirm("Are you sure you want to delete this bid?")) {
            return;
        }

        try {
            const { error } = await supabase
                .from("bids")
                .delete()
                .eq("id", bidId);

            if (error) throw error;

            toast.success("Bid deleted successfully");
            fetchUserBids();
        } catch (error) {
            console.error("Error deleting bid:", error);
            toast.error("Failed to delete bid");
        }
    };

    // Function to handle tab change and update URL
    const handleTabChange = (value: string) => {
        setActiveTab(value)
        // Update URL without refreshing the page
        const url = new URL(window.location.href)
        url.searchParams.set("tab", value)
        window.history.pushState({}, "", url.toString())
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeading title="My Dashboard" subtitle="If you're looking for it, it's most probably here" />

            <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-4 mb-4 md:mb-8">
                    <TabsTrigger value="sold" className="flex items-center justify-center text-xs sm:text-sm">
                        <ReceiptText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 hidden sm:inline" />
                        <span className="hidden sm:inline">My Listings</span>
                        <span className="sm:hidden">Listings</span>
                    </TabsTrigger>
                    <TabsTrigger value="purchased" className="flex items-center justify-center text-xs sm:text-sm">
                        <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 hidden sm:inline" />
                        <span className="hidden sm:inline">Purchases</span>
                        <span className="sm:hidden">Bought</span>
                    </TabsTrigger>
                    <TabsTrigger value="bids" className="flex items-center justify-center text-xs sm:text-sm">
                        <TagIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 hidden sm:inline" />
                        <span className="sm:hidden">Bids</span>
                        <span className="hidden sm:inline">My Bids</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center justify-center text-xs sm:text-sm">
                        <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 hidden sm:inline" />
                        <span className="hidden sm:inline">History</span>
                        <span className="sm:hidden">Log</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sold" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <p>Loading your listings...</p>
                        </div>
                    ) : soldListings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {soldListings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => router.push(`/mess/listings/${listing.id}`)}
                                >
                                    <div className="p-4 relative">
                                        {!listing.transaction && (
                                            <div className="absolute -top-1 right-4">
                                                <Button
                                                    variant="noShadow"
                                                    size="sm"
                                                    onClick={(e) => deleteListing(e, listing.id)}
                                                    className="px-2 py-1 h-auto text-xs"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex items-start mb-3 mt-6">
                                            <div className="flex items-center gap-2">
                                                <MessIcon messName={listing.mess} />
                                                <div>
                                                    <h3 className="text-xl font-bold">{listing.mess}</h3>
                                                    <p className="text-lg">{listing.meal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <CalendarDays className="h-4 w-4" />
                                            <p>{formatDate(listing.date)}</p>
                                        </div>

                                        <div className="flex items-center gap-1 text-muted-foreground mb-3">
                                            <TagIcon className="h-4 w-4" />
                                            <div>
                                                <p>Min price: {formatPrice(listing.min_price)}</p>
                                                {listing.final_price && (
                                                    <p>Sold for: {formatPrice(listing.final_price)}</p>
                                                )}
                                            </div>
                                        </div>

                                        {listing.bids && listing.bids.length > 0 && (
                                            <div className="mt-3 mb-3">
                                                <div className="flex justify-between items-center bg-muted/30 rounded-md">
                                                    <span className="text-sm font-medium">{listing.bids.length} bids</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                                            <p className="text-xs text-muted-foreground">
                                                Posted {formatRelativeTime(listing.created_at)}
                                            </p>
                                            {listing.buyer_name && (
                                                <div className="text-sm">
                                                    <p className="font-medium">Buyer: {listing.buyer_name}</p>
                                                    {listing.bids && listing.bids.some(bid => bid.accepted && bid.buyer_phone) && (
                                                        <div className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                                            <p className="text-xs text-muted-foreground">
                                                                {listing.bids.find(bid => bid.accepted)?.buyer_phone}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="mb-4">You haven't listed any meals yet.</p>
                            <Button onClick={() => router.push("/mess/listings")}>
                                Create your first listing
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="purchased" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <p>Loading your purchases...</p>
                        </div>
                    ) : myPurchases.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
                            {myPurchases.map((purchase) => (
                                <Card
                                    key={purchase.id}
                                    className="overflow-hidden w-full"
                                >
                                    <div className="p-4 relative">
                                        <div className="absolute top-4 right-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                Active Meal
                                            </span>
                                        </div>

                                        <div className="flex items-start mb-3 mt-6">
                                            <div className="flex items-center gap-2">
                                                <MessIcon messName={purchase.transaction?.mess || ""} />
                                                <div>
                                                    <h3 className="text-xl font-bold">{purchase.transaction?.mess}</h3>
                                                    <p className="text-lg">{purchase.transaction?.meal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <CalendarDays className="h-4 w-4" />
                                            <p>{formatDate(purchase.meal_date)}</p>
                                        </div>

                                        <div className="flex items-center gap-1 text-muted-foreground mb-3">
                                            <TagIcon className="h-4 w-4" />
                                            <p>Paid: {formatPrice(purchase.transaction?.sold_price)}</p>
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-md mb-2 font-semibold">
                                                Meal QR:
                                            </p>
                                            <div className="flex justify-center bg-white">
                                                <QRCode
                                                    value={purchase.seller_token || ""}
                                                    size={180}
                                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                    viewBox={`0 0 256 256`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                                            <p className="text-xs text-muted-foreground">
                                                Bought {formatRelativeTime(purchase.created_at)}
                                            </p>
                                            <p className="text-sm font-medium">
                                                {purchase.transaction?.seller?.name}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : purchasedListings.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {purchasedListings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => router.push(`/mess/listings/${listing.id}`)}
                                >
                                    <div className="p-4 relative">
                                        <div className="absolute top-4 right-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                Purchase History
                                            </span>
                                        </div>

                                        <div className="flex items-start mb-3 mt-6">
                                            <div className="flex items-center gap-2">
                                                <MessIcon messName={listing.mess} />
                                                <div>
                                                    <h3 className="text-xl font-bold">{listing.mess}</h3>
                                                    <p className="text-lg">{listing.meal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <CalendarDays className="h-4 w-4" />
                                            <p>{formatDate(listing.date)}</p>
                                        </div>

                                        <div className="flex items-center gap-1 text-muted-foreground mb-3">
                                            <TagIcon className="h-4 w-4" />
                                            <p>Price paid: {formatPrice(listing.final_price)}</p>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                                            <p className="text-xs text-muted-foreground">
                                                Purchased {formatRelativeTime(listing.created_at)}
                                            </p>
                                            <p className="text-sm font-medium">
                                                Seller: {listing.seller_name}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="mb-4">You haven't purchased any meal listings yet.</p>
                            <Button onClick={() => router.push("/mess/listings")}>
                                Browse available listings
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="bids" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <p>Loading your bids...</p>
                        </div>
                    ) : myBids.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {myBids.map((bid) => (
                                <Card
                                    key={bid.id}
                                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                    onClick={() => router.push(`/mess/listings/${bid.listing_id}`)}
                                >
                                    <div className="p-4 relative">
                                        <div className="absolute top-4 right-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                                                ${bid.paid ? "bg-amber-100 text-amber-800" : bid.accepted ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                                {bid.paid ? "Paid" : bid.accepted ? "Accepted" : "Pending"}
                                            </span>
                                        </div>

                                        {!bid.accepted && !bid.paid && (
                                            <div className="absolute -top-1 left-4">
                                                <Button
                                                    variant="noShadow"
                                                    size="sm"
                                                    onClick={(e) => deleteBid(e, bid.id)}
                                                    className="px-2 py-1 h-auto text-xs"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex items-start mb-3 mt-6">
                                            <div className="flex items-center gap-2">
                                                <MessIcon messName={bid.listing?.mess} />
                                                <div>
                                                    <h3 className="text-xl font-bold">{bid.listing?.mess}</h3>
                                                    <p className="text-lg">{bid.listing?.meal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <CalendarDays className="h-4 w-4" />
                                            <p>{formatDate(bid.listing?.date)}</p>
                                        </div>

                                        <div className="flex flex-col gap-1 text-muted-foreground mb-3">
                                            <div className="flex items-center gap-1">
                                                <TagIcon className="h-4 w-4" />
                                                <p>Listing price: {formatPrice(bid.listing?.min_price)}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <TagIcon className="h-4 w-4 text-transparent" />
                                                <p className="font-semibold">Your bid: {formatPrice(bid.bid_price)}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                                            <p className="text-xs text-muted-foreground">
                                                Bid placed {formatRelativeTime(bid.created_at)}
                                            </p>
                                            <p className="text-sm font-medium">
                                                Seller: {bid.seller_name}
                                            </p>
                                        </div>

                                        {bid.accepted && !bid.paid && (
                                            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-md text-sm">
                                                <p className="text-emerald-800">
                                                    <span className="font-semibold">Your bid was accepted!</span> Please contact the seller to arrange payment.
                                                </p>
                                            </div>
                                        )}

                                        {bid.paid && (
                                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm">
                                                <p className="text-amber-800">
                                                    <span className="font-semibold">Payment confirmed!</span> The transaction is complete.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="mb-4">You haven't placed any bids yet.</p>
                            <Button onClick={() => router.push("/mess/listings")}>
                                Browse available listings
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <p>Loading transaction history...</p>
                        </div>
                    ) : transactions.length > 0 ? (
                        <TransactionsTable data={transactions} userRollNumber={session?.user?.rollNumber || ""} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="mb-4">No transaction history yet.</p>
                            <p className="text-sm text-muted-foreground">
                                Your completed transactions will appear here.
                            </p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

// Export the dashboard component wrapped in Suspense
export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64">Loading...</div>}>
            <Dashboard />
        </Suspense>
    )
}