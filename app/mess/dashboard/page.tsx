"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation" // Add router import
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import { CalendarDays, ShoppingBag, ReceiptText, TagIcon } from "lucide-react"
import { toast } from "sonner"
import { formatRelativeTime } from "@/lib/utils"

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
    status?: string
    transaction?: boolean
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

export default function DashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [soldListings, setSoldListings] = useState<Listing[]>([])
    const [purchasedListings, setPurchasedListings] = useState<Listing[]>([])
    const [myBids, setMyBids] = useState<bid[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("sold")

    useEffect(() => {
        if (status === "authenticated" && session?.user?.rollNumber) {
            fetchUserListings()
            fetchUserBids()
            fetchTransactionHistory()
        }
    }, [status, session])

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
                        buyer:buyer_roll_number (name)
                    `)
                    .eq("listing_id", item.id)
                    .order("bid_price", { ascending: false })

                if (bidsError) console.error("Error fetching bids:", bidsError)

                const formattedBids = bids ? bids.map(bid => ({
                    ...bid,
                    buyer_name: bid.buyer ? bid.buyer.name : "Unknown Buyer"
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
    }

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
        if (!price) return "N/A"
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(price)
    }

    // Get appropriate status badge color
    const getStatusColor = (status: string | undefined) => {
        if (!status) return "bg-emerald-100 text-emerald-800"; // Default to available

        switch (status) {
            case "available":
                return "bg-emerald-100 text-emerald-800"
            case "sold":
                return "bg-blue-100 text-blue-800"
            case "cancelled":
                return "bg-red-100 text-red-800"
            case "expired":
                return "bg-amber-100 text-amber-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    // Format listing status
    const formatStatus = (listing: Listing) => {
        if (listing.status) {
            return listing.status.charAt(0).toUpperCase() + listing.status.slice(1);
        }
        return "Available"; // Default status
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeading title="My Dashboard" />

            <Tabs defaultValue="sold" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="sold" className="flex items-center justify-center">
                        <ReceiptText className="h-4 w-4 mr-2" />
                        <span>My Listings</span>
                    </TabsTrigger>
                    <TabsTrigger value="purchased" className="flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        <span>Purchases</span>
                    </TabsTrigger>
                    <TabsTrigger value="bids" className="flex items-center justify-center">
                        <TagIcon className="h-4 w-4 mr-2" />
                        <span>My Bids</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        <span>History</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sold" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <p>Loading your listings...</p>
                        </div>
                    ) : soldListings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {soldListings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => router.push(`/mess/listings/${listing.id}`)}
                                >
                                    <div className="p-4 relative">
                                        <div className="absolute top-4 right-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(listing.status)}`}>
                                                {formatStatus(listing)}
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
                                            <div>
                                                <p>Min price: {formatPrice(listing.min_price)}</p>
                                                {listing.final_price && (
                                                    <p>Sold for: {formatPrice(listing.final_price)}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                                            <p className="text-xs text-muted-foreground">
                                                Posted {formatRelativeTime(listing.created_at)}
                                            </p>
                                            {listing.buyer_name && (
                                                <p className="text-sm font-medium">
                                                    Buyer: {listing.buyer_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="mb-4">You haven't listed any meals yet.</p>
                            <Button onClick={() => window.location.href = "/mess/listings"}>
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
                    ) : purchasedListings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {purchasedListings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => router.push(`/mess/listings/${listing.id}`)}
                                >
                                    <div className="p-4 relative">
                                        <div className="absolute top-4 right-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(listing.status)}`}>
                                                {formatStatus(listing)}
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
                            <Button onClick={() => window.location.href = "/mess/listings"}>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                                        <div className="flex items-start mb-3 mt-6">
                                            <div className="flex items-center gap-2">
                                                <MessIcon messName={bid.listing.mess} />
                                                <div>
                                                    <h3 className="text-xl font-bold">{bid.listing.mess}</h3>
                                                    <p className="text-lg">{bid.listing.meal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <CalendarDays className="h-4 w-4" />
                                            <p>{formatDate(bid.listing.date)}</p>
                                        </div>

                                        <div className="flex flex-col gap-1 text-muted-foreground mb-3">
                                            <div className="flex items-center gap-1">
                                                <TagIcon className="h-4 w-4" />
                                                <p>Listing price: {formatPrice(bid.listing.min_price)}</p>
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
                            <Button onClick={() => window.location.href = "/mess/listings"}>
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
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Date
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Meal
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Mess
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Listed Price
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Sold Price
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Role
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Other Party
                                        </TableHead>
                                        <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Time to Sale
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card divide-y divide-border">
                                    {transactions.map((tx) => {
                                        const isUserBuyer = tx.buyer_id === session?.user?.rollNumber;
                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    {formatDate(tx.date_of_transaction)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    {tx.meal}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    {tx.mess}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    {formatPrice(tx.listing_price)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm font-medium">
                                                    {formatPrice(tx.sold_price)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isUserBuyer ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                                                        {isUserBuyer ? "Buyer" : "Seller"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">
                                                    {isUserBuyer ? tx.seller_name : tx.buyer_name}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                                    {tx.time_gap}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
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