"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import { Plus, Filter, Search, CalendarDays, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useDebounce } from "@/lib/hooks"
import { formatRelativeTime } from "@/lib/utils"
import { fetchFilteredListings, getBidCounts } from "./fetch-listings"

import { PageHeading } from "@/components/ui/page-heading"
import { MessIcon } from "@/components/ui/mess-icon"
import { Card } from "@/components/ui/card"
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
    bid_count: number
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
    const [messFilter, setMessFilter] = useState<string>("all")
    const [searchInputValue, setSearchInputValue] = useState<string>("")
    const searchQuery = useDebounce(searchInputValue, 300)
    const [showFilters, setShowFilters] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)

    // Animation for filter menu
    useEffect(() => {
        if (filterRef.current) {
            if (showFilters) {
                filterRef.current.style.maxHeight = `${filterRef.current.scrollHeight}px`
                filterRef.current.style.opacity = '1'
            } else {
                filterRef.current.style.maxHeight = '0'
                filterRef.current.style.opacity = '0'
            }
        }
    }, [showFilters])

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

    // Fetch listings on component mount and set up real-time subscriptions
    useEffect(() => {
        fetchListings()

        // Set up real-time subscriptions
        const listingsChannel = supabase
            .channel('public:listings')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'listings'
                },
                (payload) => {
                    // Refresh listings when data changes
                    fetchListings()
                }
            )
            .subscribe()

        const bidsChannel = supabase
            .channel('public:bids')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bids'
                },
                (payload) => {
                    // When a bid changes, just update the affected listing's bid count
                    // without fetching all listings again
                    const listingId =
                        (payload.new && 'listing_id' in payload.new ? payload.new.listing_id : undefined) ||
                        (payload.old && 'listing_id' in payload.old ? payload.old.listing_id : undefined)

                    if (listingId) {
                        if (payload.eventType === 'INSERT') {
                            // Increment bid count for the specific listing
                            setListings(prevListings =>
                                prevListings.map(listing =>
                                    listing.id === listingId
                                        ? { ...listing, bid_count: (listing.bid_count || 0) + 1 }
                                        : listing
                                )
                            );

                            // Also update filtered listings
                            setFilteredListings(prevFiltered => {
                                const targetListing = prevFiltered.find(listing => listing.id === listingId);
                                if (targetListing) {
                                    return prevFiltered.map(listing =>
                                        listing.id === listingId
                                            ? { ...listing, bid_count: (listing.bid_count || 0) + 1 }
                                            : listing
                                    );
                                }
                                return prevFiltered;
                            });
                        } else if (payload.eventType === 'DELETE') {
                            // Decrement bid count for the specific listing
                            setListings(prevListings =>
                                prevListings.map(listing =>
                                    listing.id === listingId
                                        ? { ...listing, bid_count: Math.max(0, (listing.bid_count || 0) - 1) }
                                        : listing
                                )
                            );

                            // Also update filtered listings
                            setFilteredListings(prevFiltered => {
                                const targetListing = prevFiltered.find(listing => listing.id === listingId);
                                if (targetListing) {
                                    return prevFiltered.map(listing =>
                                        listing.id === listingId
                                            ? { ...listing, bid_count: Math.max(0, (listing.bid_count || 0) - 1) }
                                            : listing
                                    );
                                }
                                return prevFiltered;
                            });
                        } else {
                            // For updates, check if this is a bid being accepted or unaccepted
                            if (payload.new && payload.old &&
                                payload.new.accepted !== payload.old.accepted) {
                                // If a bid acceptance status changed, refresh all listings
                                // This handles both accepting and unaccepting bids
                                fetchListings();
                            } else {
                                // For other updates, just update the bid count
                                updateBidCountForListing(listingId);
                            }
                        }
                    }
                }
            )
            .subscribe()

        // Clean up subscriptions on unmount
        return () => {
            supabase.removeChannel(listingsChannel)
            supabase.removeChannel(bidsChannel)
        }
    }, [])

    // Update bid count for a specific listing
    const updateBidCountForListing = async (listingId: string) => {
        try {
            // Get the count of bids for the specific listing
            const { data, error } = await supabase
                .from("bids")
                .select('id', { count: 'exact' })
                .eq('listing_id', listingId)

            if (error) {
                console.error("Error fetching bid count:", error)
                return
            }

            const count = data.length

            // Update both listings and filteredListings with the new bid count
            setListings(prevListings => {
                const updatedListings = prevListings.map(listing =>
                    listing.id === listingId
                        ? { ...listing, bid_count: count }
                        : listing
                );
                return updatedListings;
            });

            setFilteredListings(prevFiltered => {
                const targetListing = prevFiltered.find(listing => listing.id === listingId);
                if (targetListing) {
                    return prevFiltered.map(listing =>
                        listing.id === listingId
                            ? { ...listing, bid_count: count }
                            : listing
                    );
                }
                return prevFiltered; // No changes if the listing is not in filtered list
            });
        } catch (error) {
            console.error("Error updating bid count:", error)
        }
    }

    // Apply filters whenever filters change
    useEffect(() => {
        applyFilters()
    }, [listings, selectedDate, mealFilter, messFilter, searchQuery])

    // Fetch listings from Supabase
    const fetchListings = async () => {
        try {
            setLoading(true)

            // Use the utility function to get filtered listings (without listings that have accepted bids)
            const { data, error } = await fetchFilteredListings();

            if (error) {
                toast.error("Failed to load listings")
                return
            }

            // Get all listing IDs to fetch their bid counts
            const listingIds = data.map(listing => listing.id)

            // Get bid counts for all listings
            const bidCountMap = await getBidCounts(listingIds);

            // Transform the data to include user information and bid count
            const formattedListings = data.map(item => ({
                ...item,
                user_name: item.users ? item.users.name : "Unknown User",
                user_email: item.users ? item.users.email : "",
                bid_count: bidCountMap.get(item.id) || 0,
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
            const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
            filtered = filtered.filter(listing => {
                const listingDate = format(new Date(listing.date), 'yyyy-MM-dd')
                return listingDate === selectedDateStr
            })
        }

        // Filter by meal type
        if (mealFilter && mealFilter !== "all") {
            filtered = filtered.filter(listing =>
                listing.meal === mealFilter
            )
        }

        // Filter by mess
        if (messFilter && messFilter !== "all") {
            filtered = filtered.filter(listing =>
                listing.mess === messFilter
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
        setMessFilter("all")
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
                setShowAuthForm(true);
                setIsDialogOpen(false); // Close the listing creation dialog
                toast.error("Please update your API key");
                return null;
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
            [name]: name === "min_price" ? (value === "" ? 0 : parseFloat(value)) : value,
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
        if (!newListing.date || !newListing.meal || newListing.min_price < 0 || newListing.min_price === undefined) {
            toast.error("Please fill in all required fields");
            return;
        }

        // Check if the listing date is in the past
        const currentDate = new Date();
        const listingDate = new Date(newListing.date);

        // For comparing days (to see if it's a past date)
        const currentDateOnly = new Date(currentDate);
        currentDateOnly.setHours(0, 0, 0, 0);
        const listingDateOnly = new Date(listingDate);
        listingDateOnly.setHours(0, 0, 0, 0);

        if (listingDateOnly < currentDateOnly) {
            toast.error("Cannot create a listing for a meal from the past");
            return;
        }

        // Check time restrictions for same-day listings
        if (listingDateOnly.getTime() === currentDateOnly.getTime()) {
            const currentHour = currentDate.getHours();
            const currentMinutes = currentDate.getMinutes();
            const currentTimeInMinutes = timeToMinutes(currentHour, currentMinutes);

            // Define cut-off times for each meal
            const breakfastCutoff = timeToMinutes(9, 30);  // 9:30 AM
            const lunchCutoff = timeToMinutes(14, 30);     // 2:30 PM
            const snacksCutoff = timeToMinutes(18, 30);    // 6:30 PM
            const dinnerCutoff = timeToMinutes(21, 30);    // 9:30 PM

            // Time restrictions based on meal type
            if (newListing.meal === "Breakfast" && currentTimeInMinutes >= breakfastCutoff) {
                toast.error("Cannot sell breakfast after 9:30 AM on the same day");
                return;
            } else if (newListing.meal === "Lunch" && currentTimeInMinutes >= lunchCutoff) {
                toast.error("Cannot sell lunch after 2:30 PM on the same day");
                return;
            } else if (newListing.meal === "Snacks" && currentTimeInMinutes >= snacksCutoff) {
                toast.error("Cannot sell snacks after 5:30 PM on the same day");
                return;
            } else if (newListing.meal === "Dinner" && currentTimeInMinutes >= dinnerCutoff) {
                toast.error("Cannot sell dinner after 9:30 PM on the same day");
                return;
            }
        }

        // Inform the user if they're listing for free
        if (newListing.min_price === 0) {
            toast.info("You're listing this meal with no minimum price (₹0)");
        }

        try {
            // Set loading state
            setIsMessLoading(true);

            // Check if the user has an API key configured
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('api_key')
                .eq('roll_number', session.user.rollNumber)
                .single();

            if (userError || !userData?.api_key) {
                // Show the auth form since API key is null
                setShowAuthForm(true);
                setIsDialogOpen(false); // Close the listing creation dialog
                toast.error("Please set your API key to create a listing");
                setIsMessLoading(false);
                return;
            }

            // Fetch the user's mess for the selected date and meal
            const userMess = await fetchUserMess(newListing.date, newListing.meal);

            if (!userMess) {
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

    // Helper function to convert time to minutes since midnight
    const timeToMinutes = (hours: number, minutes: number) => {
        return hours * 60 + minutes;
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <PageHeading title="Meal Listings" subtitle="Your next meal could be right here" />
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex-1 relative min-w-[200px] w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search listings..."
                        className="pl-8 w-full"
                        value={searchInputValue}
                        onChange={(e) => setSearchInputValue(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                        variant="neutral"
                        size="sm"
                        className="flex items-center"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                    {session?.user ? (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => setIsDialogOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Listing
                        </Button>
                    ) : (
                        <div className="text-sm text-muted-foreground flex items-center">
                            Sign in to create a listing
                        </div>
                    )}
                </div>
            </div>
            {/* Filters */}
            <div
                ref={filterRef}
                className="mb-6 p-4 bg-main-foreground/5 rounded-lg overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: showFilters ? '1000px' : '0', opacity: showFilters ? '1' : '0' }}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select meal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Meals</SelectItem>
                                {mealTypes.map((meal) => (
                                    <SelectItem key={meal} value={meal}>{meal}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <p className="mb-2 text-sm font-medium">Mess</p>
                        <Select
                            value={messFilter}
                            onValueChange={setMessFilter}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select mess" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Messes</SelectItem>
                                {["Yuktahar", "South", "North", "Kadamba"].map((mess) => (
                                    <SelectItem key={mess} value={mess} className="flex items-center">
                                        <div className="flex items-center">
                                            <MessIcon className="text-white" messName={mess} size={18} />
                                            <span className="ml-2">{mess}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => {
                            setSelectedDate(undefined)
                            setMealFilter("all")
                            setMessFilter("all")
                        }}
                    >
                        Reset Filters
                    </Button>
                </div>
            </div>

            {/* Listings grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <p>Loading listings...</p>
                </div>
            ) : filteredListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {filteredListings.map((listing) => (
                        <Card
                            key={listing.id}
                            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow focus:outline-2 focus:outline-primary focus:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline"
                            onClick={() => router.push(`/mess/listings/${listing.id}`)}
                            tabIndex={0}
                            role="button"
                            aria-label={`View details for ${listing.mess} ${listing.meal} on ${formatDate(listing.date)}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push(`/mess/listings/${listing.id}`);
                                }
                            }}
                        >
                            <div className="p-5">
                                {/* Mess name and price row */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <MessIcon messName={listing.mess} size={24} />
                                        <h3 className="text-xl font-bold">{listing.mess}</h3>
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {formatPrice(listing.min_price)}
                                    </div>
                                </div>

                                {/* Meal and date row */}
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-lg font-medium">{listing.meal}</p>
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                        <p className="font-semibold text-md">{formatDate(listing.date)}</p>
                                    </div>
                                </div>

                                {/* Bids count, seller name, and relative time */}
                                <div className="flex justify-between items-center pt-3 border-t border-border/30">
                                    <div className="flex items-center gap-1">
                                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{listing.bid_count} {listing.bid_count === 1 ? 'bid' : 'bids'}</span>
                                    </div>
                                    <p className="text-sm font-medium">
                                        {listing.user_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatRelativeTime(listing.created_at)}
                                    </p>
                                </div>
                            </div>
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
                requireApiKey={true}
            />

            {/* Dialog with create listing form */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Listing</DialogTitle>
                        <DialogDescription>
                            Create a new listing to sell your mess meal.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateListing}>
                        <div className="space-y-4 py-2">
                            <div>
                                <label htmlFor="min_price" className="text-sm font-medium block mb-1">
                                    Minimum Price (₹)
                                </label>
                                <Input
                                    id="min_price"
                                    name="min_price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newListing.min_price !== undefined ? newListing.min_price : ""}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="meal" className="text-sm font-medium block mb-1">
                                    Meal
                                </label>
                                <Select
                                    value={newListing.meal}
                                    onValueChange={(value) => {
                                        setNewListing({
                                            ...newListing,
                                            meal: value
                                        });
                                    }}
                                    name="meal"
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a meal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mealTypes.map((meal) => (
                                            <SelectItem key={meal} value={meal}>{meal}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                    min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
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

                        <DialogFooter className="mt-4">
                            <Button type="submit" disabled={isMessLoading}>
                                Create Listing
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
