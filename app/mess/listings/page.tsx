"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Filter, Search, ArrowUpDown } from "lucide-react"
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

// Define types for our listings
interface Listing {
    id: string
    title: string
    description: string
    cuisine_type: string
    price: number
    date: string
    location: string
    user_id: string
    created_at: string
    user_name: string
    user_email: string
    min_price: number
    mess: string
    meal: string
}

export default function ListingsPage() {
    const router = useRouter()
    const { data: session, status } = useSession()

    // State for listings and filters
    const [listings, setListings] = useState<Listing[]>([])
    const [filteredListings, setFilteredListings] = useState<Listing[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [cuisineFilter, setCuisineFilter] = useState<string>("")
    const [priceSort, setPriceSort] = useState<"asc" | "desc" | "">("")
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [showFilters, setShowFilters] = useState(false)

    // State for new listing form
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const [newListing, setNewListing] = useState({
        title: "",
        description: "",
        cuisine_type: "",
        price: 0,
        date: "",
        location: "",
        min_price: 0,
        mess: "",
        meal: ""
    })

    // Cuisine type options
    const cuisineTypes = [
        "North Indian",
        "South Indian",
        "Chinese",
        "Continental",
        "Italian",
        "Fast Food",
        "Desserts",
        "Beverages",
        "Other"
    ]

    // Mess options
    const messOptions = [
        "North",
        "South",
        "Kadamba",
        "Yuktahar"
    ]

    // Meal options
    const mealOptions = [
        "Breakfast",
        "Lunch",
        "Dinner"
    ]

    // Fetch listings on component mount
    useEffect(() => {
        fetchListings()
    }, [])

    // Apply filters whenever filters change
    useEffect(() => {
        applyFilters()
    }, [listings, selectedDate, cuisineFilter, priceSort, searchQuery])

    // Fetch listings from Supabase
    const fetchListings = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("listings")
                .select(`
          *,
          users:user_id (
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

        // Filter by cuisine type
        if (cuisineFilter) {
            filtered = filtered.filter(listing =>
                listing.cuisine_type === cuisineFilter
            )
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(listing =>
                listing.title.toLowerCase().includes(query) ||
                listing.description.toLowerCase().includes(query) ||
                listing.location.toLowerCase().includes(query)
            )
        }

        // Sort by price
        if (priceSort) {
            filtered.sort((a, b) => {
                if (priceSort === "asc") {
                    return a.price - b.price
                } else {
                    return b.price - a.price
                }
            })
        }

        setFilteredListings(filtered)
    }

    // Reset all filters
    const resetFilters = () => {
        setSelectedDate(undefined)
        setCuisineFilter("")
        setPriceSort("")
        setSearchQuery("")
        setFilteredListings(listings)
    }

    // Handle input changes for new listing form
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setNewListing({
            ...newListing,
            [name]: name === "price" || name === "min_price" ? parseFloat(value) : value,
        })
    }

    // Create a new listing
    const handleCreateListing = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!session?.user) {
            toast.error("You must be logged in to create a listing")
            return
        }

        try {
            const { data, error } = await supabase
                .from("listings")
                .insert({
                    ...newListing,
                    user_id: session.user.id,
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
                title: "",
                description: "",
                cuisine_type: "",
                price: 0,
                date: "",
                location: "",
                min_price: 0,
                mess: "",
                meal: ""
            })
            fetchListings()
        } catch (error) {
            console.error("Error:", error)
            toast.error("An unexpected error occurred")
        }
    }

    // Create a quick listing (mess meal)
    const handleCreateQuickListing = async () => {
        if (!session?.user) {
            toast.error("You must be logged in to create a listing")
            return
        }

        if (!newListing.mess || !newListing.meal || !newListing.date) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            const { data, error } = await supabase
                .from("listings")
                .insert({
                    title: `${newListing.mess} Mess ${newListing.meal}`,
                    description: `Looking for someone to share ${newListing.meal.toLowerCase()} at ${newListing.mess} mess`,
                    min_price: newListing.min_price || 0,
                    date: newListing.date,
                    mess: newListing.mess,
                    meal: newListing.meal,
                    user_id: session.user.id,
                })
                .select()

            if (error) {
                console.error("Error creating listing:", error)
                toast.error("Failed to create listing")
                return
            }

            toast.success("Mess listing created successfully!")
            setIsPopoverOpen(false)
            setNewListing({
                ...newListing,
                min_price: 0,
                mess: "",
                meal: "",
                date: ""
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
                {/* Styled heading like canteen cards */}
                <div className="border-4 border-black shadow-shadow bg-main text-main-foreground p-4 w-full max-w-md rounded-lg transform rotate-1">
                    <h1 className="text-4xl sm:text-5xl font-heading text-center mb-4">Food Listings</h1>
                    <p className="text-base sm:text-lg font-base text-center">Find someone to share a meal with</p>
                </div>

                {status === "authenticated" && (
                    <div className="flex space-x-4">
                        {/* Quick Add Popover */}
                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Listing
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h3 className="font-medium leading-none">Create Quick Listing</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Fill in the details for your mess meal listing
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <label htmlFor="mess">Mess</label>
                                            <Select
                                                value={newListing.mess}
                                                onValueChange={(value) => setNewListing({ ...newListing, mess: value })}
                                            >
                                                <SelectTrigger className="col-span-2">
                                                    <SelectValue placeholder="Select mess" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {messOptions.map((mess) => (
                                                        <SelectItem key={mess} value={mess}>
                                                            {mess}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <label htmlFor="meal">Meal</label>
                                            <Select
                                                value={newListing.meal}
                                                onValueChange={(value) => setNewListing({ ...newListing, meal: value })}
                                            >
                                                <SelectTrigger className="col-span-2">
                                                    <SelectValue placeholder="Select meal" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mealOptions.map((meal) => (
                                                        <SelectItem key={meal} value={meal}>
                                                            {meal}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <label htmlFor="date">Date</label>
                                            <div className="col-span-2">
                                                <DatePicker
                                                    date={newListing.date ? new Date(newListing.date) : undefined}
                                                    setDate={(date) => setNewListing({
                                                        ...newListing,
                                                        date: date ? date.toISOString().split('T')[0] : ""
                                                    })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <label htmlFor="min_price">Min Price ₹</label>
                                            <Input
                                                id="min_price"
                                                name="min_price"
                                                type="number"
                                                min="0"
                                                value={newListing.min_price || ""}
                                                onChange={handleInputChange}
                                                className="col-span-2"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleCreateQuickListing}>Create Listing</Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Full Listing Dialog */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    Create Detailed Listing
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Create New Food Listing</DialogTitle>
                                    <DialogDescription>
                                        Share your food with others at IIIT. Fill in the details below.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreateListing}>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="title" className="text-right text-sm font-medium col-span-1">
                                                Title
                                            </label>
                                            <Input
                                                id="title"
                                                name="title"
                                                value={newListing.title}
                                                onChange={handleInputChange}
                                                className="col-span-3"
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="description" className="text-right text-sm font-medium col-span-1">
                                                Description
                                            </label>
                                            <Input
                                                id="description"
                                                name="description"
                                                value={newListing.description}
                                                onChange={handleInputChange}
                                                className="col-span-3"
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="cuisine_type" className="text-right text-sm font-medium col-span-1">
                                                Cuisine
                                            </label>
                                            <Select
                                                name="cuisine_type"
                                                value={newListing.cuisine_type}
                                                onValueChange={(value) => setNewListing({ ...newListing, cuisine_type: value })}
                                            >
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue placeholder="Select cuisine type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cuisineTypes.map((cuisine) => (
                                                        <SelectItem key={cuisine} value={cuisine}>
                                                            {cuisine}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="price" className="text-right text-sm font-medium col-span-1">
                                                Price (₹)
                                            </label>
                                            <Input
                                                id="price"
                                                name="price"
                                                type="number"
                                                min="0"
                                                value={newListing.price || ""}
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
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="location" className="text-right text-sm font-medium col-span-1">
                                                Location
                                            </label>
                                            <Input
                                                id="location"
                                                name="location"
                                                value={newListing.location}
                                                onChange={handleInputChange}
                                                className="col-span-3"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit">Create Listing</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </div>

            {/* Filters and search */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Search listings..."
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-main-foreground/5 rounded-base">
                        <div>
                            <p className="mb-2 text-sm font-medium">Date</p>
                            <DatePicker
                                date={selectedDate}
                                setDate={setSelectedDate}
                            />
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">Cuisine Type</p>
                            <Select
                                value={cuisineFilter}
                                onValueChange={setCuisineFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All cuisines" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All cuisines</SelectItem>
                                    {cuisineTypes.map((cuisine) => (
                                        <SelectItem key={cuisine} value={cuisine}>
                                            {cuisine}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">Price</p>
                            <Select
                                value={priceSort}
                                onValueChange={(value: string) => setPriceSort(value as "asc" | "desc" | "")}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Sort by price" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Default</SelectItem>
                                    <SelectItem value="asc">Low to High</SelectItem>
                                    <SelectItem value="desc">High to Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="noShadow"
                            onClick={resetFilters}
                            className="md:col-start-3"
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
                                <CardTitle>{listing.title}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Posted by {listing.user_name}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-2">{listing.description}</p>
                                <div className="space-y-1">
                                    {listing.cuisine_type && (
                                        <p className="text-sm"><span className="font-medium">Cuisine:</span> {listing.cuisine_type}</p>
                                    )}
                                    {listing.price > 0 && (
                                        <p className="text-sm"><span className="font-medium">Price:</span> {formatPrice(listing.price)}</p>
                                    )}
                                    {listing.min_price > 0 && (
                                        <p className="text-sm"><span className="font-medium">Minimum Price:</span> {formatPrice(listing.min_price)}</p>
                                    )}
                                    <p className="text-sm"><span className="font-medium">Date:</span> {new Date(listing.date).toLocaleDateString()}</p>
                                    {listing.mess && (
                                        <p className="text-sm"><span className="font-medium">Mess:</span> {listing.mess}</p>
                                    )}
                                    {listing.meal && (
                                        <p className="text-sm"><span className="font-medium">Meal:</span> {listing.meal}</p>
                                    )}
                                    {listing.location && (
                                        <p className="text-sm"><span className="font-medium">Location:</span> {listing.location}</p>
                                    )}
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
                    {searchQuery || selectedDate || cuisineFilter || priceSort ? (
                        <Button onClick={resetFilters} variant="noShadow">
                            Clear Filters
                        </Button>
                    ) : status === "authenticated" ? (
                        <Button onClick={() => setIsPopoverOpen(true)}>
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