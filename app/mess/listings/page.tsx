"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import { Plus, Filter, Search, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { useDebounce } from "@/lib/hooks"

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import UserAuthForm from "@/components/auth/UserAuthForm"

interface Listing {
    id: string
    min_price: number
    date: string
    meal: string
    mess: string
    seller_id: string
    created_at: string
    user_name: string
    user_email: string
}

export default function ListingsPage() {
    const router = useRouter()
    const { data: session, status } = useSession()

    // State for listings and filters
    const [listings, setListings] = useState<Listing[]>([])
    const [filteredListings, setFilteredListings] = useState<Listing[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [mealFilter, setMealFilter] = useState<string>("all")
    const [searchInputValue, setSearchInputValue] = useState<string>("")
    const searchQuery = useDebounce(searchInputValue, 300)
    const [showFilters, setShowFilters] = useState(false)

    // State for new listing form
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newListing, setNewListing] = useState({
        min_price: 0,
        date: "",
        meal: "",
        mess: ""
    })
    const [isMessLoading, setIsMessLoading] = useState(false)
    const [showAuthForm, setShowAuthForm] = useState(false)

    // Meal type options
    const mealTypes = ["Breakfast", "Lunch", "Snacks", "Dinner"]

    // Fetch listings on component mount
    useEffect(() => {
        fetchListings()
    }, [])

    // Apply filters whenever filters change
    useEffect(() => {
        applyFilters()
    }, [listings, selectedDate, mealFilter, searchQuery])

    // Fetch listings from Supabase
    const fetchListings = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("listings")
                .select(`
                    *,
                    users:seller_id (
                        name,
                        email
                    )
                `)
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Error fetching listings:", error)
                toast.error("Failed to load listings")
                return
            }

            // Transform the data to include user information
            const formattedListings = data.map(item => ({
                ...item,
                user_name: item.users ? item.users.name : "Unknown User",
                user_email: item.users ? item.users.email : "",
            }))

            setListings(formattedListings)
            setFilteredListings(formattedListings)
        } catch (error) {
            console.error("Error:", error)
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    // Apply filters to listings
    const applyFilters = () => {
        let filtered = [...listings]

        // Filter by date
        if (selectedDate) {
            const dateString = selectedDate.toISOString().split('T')[0]
            filtered = filtered.filter(listing =>
                listing.date.includes(dateString)
            )
        }

        // Filter by meal type
        if (mealFilter && mealFilter !== "all") {
            filtered = filtered.filter(listing =>
                listing.meal === mealFilter
            )
        }

        // Filter by search query (search in mess name, seller name, and meal type)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(listing =>
                listing.mess.toLowerCase().includes(query) ||
                listing.user_name.toLowerCase().includes(query) ||
                listing.meal.toLowerCase().includes(query)
            )
        }

        setFilteredListings(filtered)
    }

    // Reset all filters
    const resetFilters = () => {
        setSelectedDate(undefined)
        setMealFilter("all")
        setSearchInputValue("")
        setFilteredListings(listings)
    }

    // Format date in the requested format: "28th May (Tue)"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    // Fetch user's registered mess from the IIIT mess API via our proxy
    const fetchUserMess = async (date: string, meal: string) => {
        try {
            setIsMessLoading(true)

            if (!session?.user?.rollNumber) {
                toast.error("User information is missing")
                return null
            }

            // Ensure date is in yyyy-mm-dd format
            const formattedDate = new Date(date).toISOString().split('T')[0];

            // Use our proxy API and pass the user's roll number to get their API key
            const response = await fetch(`/api/mess-registration?meal=${meal.toLowerCase()}&date=${formattedDate}&userId=${session.user.rollNumber}`)

            // Handle different response statuses
            if (response.status === 401) {
                // User needs to authenticate with the mess system
                setShowAuthForm(true)
                toast.error("Please update your API key")
                return null
            }

            if (!response.ok) {
                if (response.status === 404) {
                    toast.error("No mess registration found for this date and meal")
                    return null
                }
                throw new Error(`API error: ${response.status}`)
            }

            const data = await response.json()

            // Check if the meal is cancelled
            if (data.data?.cancelled_at != null) {
                toast.error("This meal has been cancelled")
                return null
            }

            // Check if the meal is availed
            if (data.data?.availed_at != null) {
                toast.error("This meal has been availed in the mess already")
                return null
            }

            return data.data?.meal_mess || null
        } catch (error) {
            console.error("Error fetching mess registration:", error)
            toast.error("Failed to fetch your mess registration")
            return null
        } finally {
            setIsMessLoading(false)
        }
    }

    // Handle input changes for new listing form
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setNewListing({
            ...newListing,
            [name]: name === "min_price" ? parseFloat(value) : value,
        })
    }

    // Create a new listing
    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!session?.user) {
            toast.error("You must be logged in to create a listing");
            return;
        }

        // Validate the form
        if (!newListing.date || !newListing.meal || newListing.min_price <= 0) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            // Set loading state
            setIsMessLoading(true);

            // Fetch the user's mess for the selected date and meal
            const userMess = await fetchUserMess(newListing.date, newListing.meal);

            if (!userMess) {
                toast.error("Failed to fetch your mess registration");
                setIsMessLoading(false);
                return;
            }

            // Format the mess name appropriately (remove any -veg/-nonveg suffix)
            const messName = userMess.split('-')[0].charAt(0).toUpperCase() + userMess.split('-')[0].slice(1);

            // Create the new listing in Supabase
            const { data, error } = await supabase
                .from("listings")
                .insert({
                    min_price: newListing.min_price,
                    date: newListing.date,
                    meal: newListing.meal,
                    mess: messName,
                    seller_id: session.user.rollNumber, // Use roll number as seller_id
                })
                .select();

            if (error) {
                console.error("Error creating listing:", error);
                toast.error(`Failed to create listing: ${error.message}`);
                return;
            }


            toast.success("Listing created successfully!");

            // Reset form and close dialog
            setIsDialogOpen(false);
            setNewListing({
                min_price: 0,
                date: "",
                meal: "",
                mess: ""
            });

            // Refresh listings
            fetchListings();
        } catch (error) {
            console.error("Error:", error);
            toast.error(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsMessLoading(false);
        }
    };

    // Format price to INR
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(price)
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <PageHeading title="Meal Listings" />

            <div className="mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex-1 relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 h-4 w-4" />
                    <Input
                        placeholder="Search by mess, meal type, or seller..."
                        value={searchInputValue}
                        onChange={(e) => setSearchInputValue(e.target.value)}
                        className="pl-10"
                        type="search"
                    />
                </div>

                <Button
                    variant="noShadow"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                </Button>

                {status === "authenticated" && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Listing
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Create New Listing</DialogTitle>
                                <DialogDescription>
                                    List a mess meal for sale. Fill in the details below.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateListing} className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="meal" className="text-sm font-medium block mb-1">
                                            Meal
                                        </label>
                                        <Select
                                            name="meal"
                                            value={newListing.meal}
                                            onValueChange={(value) => setNewListing({ ...newListing, meal: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select meal" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {mealTypes.map((meal) => (
                                                    <SelectItem key={meal} value={meal}>
                                                        {meal}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label htmlFor="min_price" className="text-sm font-medium block mb-1">
                                            Min Price (₹)
                                        </label>
                                        <Input
                                            id="min_price"
                                            name="min_price"
                                            type="number"
                                            min="0"
                                            value={newListing.min_price || ""}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="date" className="text-sm font-medium block mb-1">
                                            Date
                                        </label>
                                        <Input
                                            id="date"
                                            name="date"
                                            type="date"
                                            value={newListing.date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    {isMessLoading && (
                                        <p className="text-center text-sm text-muted-foreground">
                                            Checking your mess registration...
                                        </p>
                                    )}

                                    <p className="text-sm text-muted-foreground text-center">
                                        Your registered mess will be automatically determined
                                    </p>
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={isMessLoading}>
                                        Create Listing
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="mb-6 p-4 bg-main-foreground/5 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="mb-2 text-sm font-medium">Date</p>
                            <DatePicker
                                date={selectedDate}
                                setDate={setSelectedDate}
                            />
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">Meal</p>
                            <Select
                                value={mealFilter}
                                onValueChange={setMealFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All meals" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All meals</SelectItem>
                                    {mealTypes.map((meal) => (
                                        <SelectItem key={meal} value={meal}>
                                            {meal}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="noShadow"
                            onClick={resetFilters}
                            className="w-full md:w-auto md:col-start-2 mt-2"
                        >
                            Reset Filters
                        </Button>
                    </div>
                </div>
            )}

            {/* Listings grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <p>Loading listings...</p>
                </div>
            ) : filteredListings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListings.map((listing) => (
                        <Card
                            key={listing.id}
                            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => router.push(`/mess/listings/${listing.id}`)}
                        >
                            <CardHeader className="p-4 bg-main-foreground/5 border-b">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MessIcon messName={listing.mess} />
                                        <div>
                                            <h3 className="text-xl font-bold">{listing.mess}</h3>
                                            <p className="text-lg">{listing.meal}</p>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {formatPrice(listing.min_price)}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <CalendarDays className="h-4 w-4" />
                                    <p>{formatDate(listing.date)}</p>
                                </div>
                            </CardContent>

                            <CardFooter className="p-4 bg-main-foreground/5 flex justify-between items-center border-t">
                                <p className="text-xs text-muted-foreground">
                                    {new Date(listing.created_at).toLocaleDateString()}
                                </p>
                                <p className="text-sm font-medium">
                                    {listing.user_name}
                                </p>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <p className="mb-4">No listings found.</p>
                    {searchInputValue || selectedDate || mealFilter !== "all" ? (
                        <Button onClick={resetFilters} variant="noShadow">
                            Clear Filters
                        </Button>
                    ) : status === "authenticated" ? (
                        <Button onClick={() => setIsDialogOpen(true)}>
                            Create your first listing
                        </Button>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Sign in to create your own listings.
                        </p>
                    )}
                </div>
            )}

            {/* Auth form for users without phone/API key */}
            <UserAuthForm
                isOpen={showAuthForm}
                onClose={() => setShowAuthForm(false)}
            />
        </div>
    )
}