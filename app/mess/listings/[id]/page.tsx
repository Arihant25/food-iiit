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
    seller: {
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
    const [bidAmount, setBidAmount] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAuthForm, setShowAuthForm] = useState(false)

    useEffect(() => {
        if (id) {
            fetchListing()
        }
    }, [id])

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

    const handleBid = async () => {
        if (!session?.user) {
            toast.error("You must be logged in to place a bid")
            return
        }

        // Check if user has phone number and API key
        if (!session.user.phoneNumber || !session.user.apiKey) {
            setShowAuthForm(true)
            return
        }

        try {
            setIsSubmitting(true)

            // Here you would add the bid to your system
            // This is a placeholder for the actual bid logic

            // For now, just simulate a successful bid
            setTimeout(() => {
                toast.success(`You've successfully placed a bid of ₹${bidAmount} for this meal`)
                setBidAmount("")
                setIsSubmitting(false)
            }, 1000)

        } catch (error) {
            console.error("Error placing bid:", error)
            toast.error("Failed to place bid")
            setIsSubmitting(false)
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
            </div>

            {/* Auth form for users without phone/API key */}
            <UserAuthForm
                isOpen={showAuthForm}
                onClose={() => setShowAuthForm(false)}
            />
        </div>
    )
}