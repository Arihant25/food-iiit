"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Filter, Search } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
    const [mealFilter, setMealFilter] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState<string>("")
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
    const [messAuthRequired, setMessAuthRequired] = useState(false)

    // Meal type options
    const mealTypes = ["Breakfast", "Lunch", "Snacks", "Dinner"]

    // Mess options
    const messOptions = ["Kadamba", "Yuktahar", "South Mess", "North Mess", "BBC", "Tantra", "David's"]

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
        if (mealFilter) {
            filtered = filtered.filter(listing =>
                listing.meal === mealFilter
            )
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(listing =>
                listing.mess.toLowerCase().includes(query)
            )
        }

        setFilteredListings(filtered)
    }

    // Reset all filters
    const resetFilters = () => {
        setSelectedDate(undefined)
        setMealFilter("")
        setSearchQuery("")
        setFilteredListings(listings)
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
                const data = await response.json()
                setMessAuthRequired(true)
                toast.error("Please log in to the IIIT mess system first")
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
        e.preventDefault()

        if (!session?.user) {
            toast.error("You must be logged in to create a listing")
            return
        }

        // Validate the form
        if (!newListing.date || !newListing.meal) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            // Fetch the user's mess for the selected date and meal
            const userMess = await fetchUserMess(newListing.date, newListing.meal)

            if (!userMess) {
                return
            }

            // Format the mess name appropriately (remove any -veg/-nonveg suffix)
            const messName = userMess.split('-')[0].charAt(0).toUpperCase() + userMess.split('-')[0].slice(1)

            const { data, error } = await supabase
                .from("listings")
                .insert({
                    min_price: newListing.min_price,
                    date: newListing.date,
                    meal: newListing.meal,
                    mess: messName,
                    seller_id: session.user.rollNumber, // Use roll number as seller_id
                })
                .select()

            if (error) {
                console.error("Error creating listing:", error)
                toast.error("Failed to create listing")
                return
            }

            toast.success("Listing created successfully!")
            setIsDialogOpen(false)
            setNewListing({
                min_price: 0,
                date: "",
                meal: "",
                mess: ""
            })
            fetchListings()
        } catch (error) {
            console.error("Error:", error)
            toast.error("An unexpected error occurred")
        }
    }

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
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold">Meal Listings</h1>

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
                            <form onSubmit={handleCreateListing}>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <label htmlFor="meal" className="text-right text-sm font-medium col-span-1">
                                            Meal
                                        </label>
                                        <Select
                                            name="meal"
                                            value={newListing.meal}
                                            onValueChange={(value) => setNewListing({ ...newListing, meal: value })}
                                        >
                                            <SelectTrigger className="col-span-3">
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
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <label htmlFor="min_price" className="text-right text-sm font-medium col-span-1">
                                            Min Price (₹)
                                        </label>
                                        <Input
                                            id="min_price"
                                            name="min_price"
                                            type="number"
                                            min="0"
                                            value={newListing.min_price || ""}
                                            onChange={handleInputChange}
                                            className="col-span-3"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <label htmlFor="date" className="text-right text-sm font-medium col-span-1">
                                            Date
                                        </label>
                                        <Input
                                            id="date"
                                            name="date"
                                            type="date"
                                            value={newListing.date}
                                            onChange={handleInputChange}
                                            className="col-span-3"
                                            required
                                        />
                                    </div>
                                    {isMessLoading && (
                                        <p className="text-center text-sm text-muted-foreground">
                                            Checking your mess registration...
                                        </p>
                                    )}
                                    <p className="text-sm text-muted-foreground col-span-4 text-center">
                                        Your registered mess will be automatically determined from the IIIT mess system
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isMessLoading}>Create Listing</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters and search */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Search by mess..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-xs"
                        type="search"
                    />

                    <Button
                        variant="noShadow"
                        onClick={() => setShowFilters(!showFilters)}
                        className="ml-auto"
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-main-foreground/5 rounded-base">
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
                                    <SelectItem value="">All meals</SelectItem>
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
                            className="md:col-start-2"
                        >
                            Reset Filters
                        </Button>
                    </div>
                )}
            </div>

            {/* Listings grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <p>Loading listings...</p>
                </div>
            ) : filteredListings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListings.map((listing) => (
                        <Card key={listing.id} className="overflow-hidden">
                            <CardHeader>
                                <CardTitle>{listing.mess}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Posted by {listing.user_name}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    <p className="text-sm"><span className="font-medium">Meal:</span> {listing.meal}</p>
                                    <p className="text-sm"><span className="font-medium">Min Price:</span> {formatPrice(listing.min_price)}</p>
                                    <p className="text-sm"><span className="font-medium">Date:</span> {new Date(listing.date).toLocaleDateString()}</p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button
                                    variant="noShadow"
                                    size="sm"
                                    onClick={() => {
                                        if (session?.user) {
                                            toast.success(`Contact info: ${listing.user_email}`)
                                        } else {
                                            toast.error("Please sign in to contact the seller")
                                        }
                                    }}
                                >
                                    Contact Seller
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(listing.created_at).toLocaleDateString()}
                                </p>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <p className="mb-4">No listings found.</p>
                    {searchQuery || selectedDate || mealFilter ? (
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
        </div>
    )
}