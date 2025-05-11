"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { supabase, adminOperation } from "@/lib/supabaseClient";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ThumbsUp, ThumbsDown, Minus, Search, ArrowDownAZ, ArrowUpZA, Leaf, Drumstick, Filter } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks";
import SwitchButton from "@/components/navigation/SwitchButton";

// Interface for menu items
interface MenuItem {
    id: string;
    name: string;
    price: number;
    category: string;
    is_nonveg: boolean;
    votes: number | null;
    canteenid: string;
    arihants_rating: number | null;
}

interface Canteen {
    id: string;
    name: string;
    avatar_url: string | null;
    timings: string | null;
}

const CanteenAdminPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [canteens, setCanteens] = useState<Canteen[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
    const [selectedCanteen, setSelectedCanteen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const searchQuery = useDebounce(searchInput, 300);
    const [selectedSort, setSelectedSort] = useState<string>("name-asc");
    const [showVeg, setShowVeg] = useState(true);
    const [showNonVeg, setShowNonVeg] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);

    // Check if the user is authorized (has the specific roll number)
    const isAuthorized = session?.user?.rollNumber === "2023111026";

    useEffect(() => {
        // If the user is not logged in, redirect to home
        if (status === "unauthenticated") {
            router.push("/");
            return;
        }

        // If the user is logged in but not authorized, redirect to canteen page
        if (status === "authenticated" && !isAuthorized) {
            toast.error("You are not authorized to access this page");
            router.push("/canteen");
            return;
        }

        // Fetch canteens if the user is authorized
        if (status === "authenticated" && isAuthorized) {
            fetchCanteens();
        }
    }, [status, isAuthorized, router]);

    // Apply filters and sorting whenever related state changes
    useEffect(() => {
        if (menuItems.length === 0) return;

        let result = [...menuItems];

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
            );
        }

        // Apply category filter
        if (selectedCategory) {
            result = result.filter(item => item.category === selectedCategory);
        }

        // Apply veg/non-veg filter
        if (showVeg && !showNonVeg) {
            result = result.filter(item => !item.is_nonveg);
        } else if (!showVeg && showNonVeg) {
            result = result.filter(item => item.is_nonveg);
        } else if (!showVeg && !showNonVeg) {
            result = []; // If both are unchecked, show nothing
        }

        // Apply sorting
        switch (selectedSort) {
            case "name-asc":
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "name-desc":
                result.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case "price-asc":
                result.sort((a, b) => a.price - b.price);
                break;
            case "price-desc":
                result.sort((a, b) => b.price - a.price);
                break;
            case "votes":
                result.sort((a, b) => (b.votes || 0) - (a.votes || 0));
                break;
            case "rating":
                // Sort by Arihant's rating (null values at the end)
                result.sort((a, b) => {
                    if (a.arihants_rating === null && b.arihants_rating === null) return 0;
                    if (a.arihants_rating === null) return 1;
                    if (b.arihants_rating === null) return -1;
                    return b.arihants_rating - a.arihants_rating;
                });
                break;
        }

        setFilteredMenuItems(result);
    }, [menuItems, searchQuery, selectedSort, showVeg, showNonVeg, selectedCategory]);

    // Fetch canteens
    const fetchCanteens = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from("canteens").select("*");

            if (error) {
                throw error;
            }

            if (data) {
                // Sort canteens alphabetically by name
                const sortedCanteens = [...data].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                setCanteens(sortedCanteens as Canteen[]);
            }
        } catch (error) {
            console.error("Error fetching canteens:", error);
            toast.error("Failed to load canteens");
        } finally {
            setLoading(false);
        }
    };

    // Fetch menu items for a selected canteen
    const fetchMenuItems = async (canteenId: string) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("menu_items")
                .select("*")
                .eq("canteenid", canteenId)
                .order("name");

            if (error) {
                throw error;
            }

            if (data) {
                setMenuItems(data);
                setFilteredMenuItems(data);

                // Extract unique categories
                const uniqueCategories = [...new Set(data.map(item => item.category))].sort();
                setCategories(uniqueCategories);
                setSelectedCategory(null); // Reset category filter
            }
        } catch (error) {
            console.error("Error fetching menu items:", error);
            toast.error("Failed to load menu items");
        } finally {
            setLoading(false);
        }
    };

    // Handle canteen selection
    const handleCanteenChange = (canteenId: string) => {
        setSelectedCanteen(canteenId);
        setSearchInput("");
        setSelectedSort("name-asc");
        setShowVeg(true);
        setShowNonVeg(true);
        setSelectedCategory(null);
        fetchMenuItems(canteenId);
    };

    // Handle rating change
    const handleRatingChange = async (itemId: string, rating: number | null) => {
        try {
            // First, find the item to get its current info for the toast message
            const item = menuItems.find(item => item.id === itemId);

            // Update the rating in the database
            const result = await adminOperation(async (client) => {
                const { data, error } = await client
                    .from("menu_items")
                    .update({ arihants_rating: rating })
                    .eq("id", itemId)
                    .select();

                if (error) {
                    console.error("Error updating rating:", error);
                    throw error;
                }

                return data;
            });

            if (result) {
                // Update the local state to reflect the change
                setMenuItems(menuItems.map(item =>
                    item.id === itemId ? { ...item, arihants_rating: rating } : item
                ));

                // Show a success message
                let ratingText = "removed rating for";
                if (rating === 1) ratingText = "liked";
                if (rating === 2) ratingText = "loved";
                if (rating === 0) ratingText = "disliked";

                toast.success(`You ${ratingText} "${item?.name}"`, {
                    position: "bottom-right",
                    duration: 3000,
                });
            }
        } catch (error) {
            console.error("Error updating rating:", error);
            toast.error("Failed to update rating");
        }
    };

    // If loading, show loading state
    if (status === "loading" || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    // If not authorized, this should be handled by the useEffect redirect
    if (!isAuthorized) {
        return null;
    }

    return (
        <main className="p-4 sm:p-6 flex flex-col min-h-screen">
            <div className="mx-2 mb-10">
                <SwitchButton />
            </div>

            <PageHeading
                title="Canteen Admin"
                subtitle="Manage your personal ratings for canteen items"
            />

            <div className="mb-6 w-full max-w-md mx-auto">
                <label className="block text-sm font-medium mb-2">Select Canteen</label>
                <Select
                    value={selectedCanteen || ""}
                    onValueChange={handleCanteenChange}
                >
                    <SelectTrigger className="w-full bg-main text-main-foreground border-2 border-black">
                        <SelectValue placeholder="Select a canteen..." />
                    </SelectTrigger>
                    <SelectContent>
                        {canteens.map((canteen) => (
                            <SelectItem key={canteen.id} value={canteen.id}>
                                {canteen.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedCanteen && (
                <div className="w-full max-w-4xl mx-auto">
                    {/* Filters Section */}
                    <div className="flex flex-col mb-6 p-4 bg-secondary-background rounded-lg border-2 border-border">
                        <h2 className="text-lg font-bold mb-4">Filters & Search</h2>

                        {/* Search input */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 size-4" />
                                <Input
                                    placeholder="Search menu items..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Category filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Category</label>
                                <Select
                                    value={selectedCategory || ""}
                                    onValueChange={(value) => setSelectedCategory(value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All categories</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sort options */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Sort by</label>
                                <Select value={selectedSort} onValueChange={setSelectedSort}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="name-asc">
                                            <div className="flex items-center gap-2">
                                                <ArrowDownAZ className="size-4" />
                                                <span>Name (A-Z)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="name-desc">
                                            <div className="flex items-center gap-2">
                                                <ArrowUpZA className="size-4" />
                                                <span>Name (Z-A)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="price-asc">
                                            <div className="flex items-center gap-2">
                                                <Filter className="size-4" />
                                                <span>Price (Low-High)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="price-desc">
                                            <div className="flex items-center gap-2">
                                                <Filter className="size-4 rotate-180" />
                                                <span>Price (High-Low)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="votes">
                                            <div className="flex items-center gap-2">
                                                <ThumbsUp className="size-4" />
                                                <span>Popularity</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="rating">
                                            <div className="flex items-center gap-2">
                                                <ThumbsUp className="size-4 text-green-600 fill-green-600" />
                                                <span>Your Rating</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Food type filter */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Food Type</label>
                                <div className="flex gap-4 mt-2">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="veg-filter"
                                            checked={showVeg}
                                            onChange={() => setShowVeg(!showVeg)}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="veg-filter" className="flex items-center cursor-pointer">
                                            <Leaf className="size-4 text-green-600 mr-1" />
                                            Veg
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="non-veg-filter"
                                            checked={showNonVeg}
                                            onChange={() => setShowNonVeg(!showNonVeg)}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="non-veg-filter" className="flex items-center cursor-pointer">
                                            <Drumstick className="size-4 text-red-600 mr-1" />
                                            Non-Veg
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold mb-4">Menu Items ({filteredMenuItems.length})</h2>

                    {filteredMenuItems.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredMenuItems.map((item) => (
                                <Card key={item.id} className="border-2 border-border">
                                    <CardHeader>
                                        <CardTitle className="flex justify-between items-center">
                                            <span>{item.name}</span>
                                            <span className="text-base">₹{item.price.toFixed(2)}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm text-muted-foreground">Category: {item.category}</span>
                                                <span className="text-sm text-muted-foreground ml-4 flex items-center">
                                                    {item.is_nonveg ?
                                                        <><Drumstick className="size-4 text-red-600 mr-1" /> Non-Veg</> :
                                                        <><Leaf className="size-4 text-green-600 mr-1" /> Veg</>
                                                    }
                                                </span>
                                                <div className="text-sm mt-1">Votes: {item.votes || 0}</div>
                                            </div>

                                            <Select
                                                value={item.arihants_rating === null ? "null" : item.arihants_rating.toString()}
                                                onValueChange={(value) => handleRatingChange(item.id, value === "null" ? null : Number(value))}
                                            >
                                                <SelectTrigger className="w-36">
                                                    <SelectValue placeholder="Rate it...">
                                                        {item.arihants_rating === 2 && (
                                                            <div className="flex items-center">
                                                                <ThumbsUp className="mr-2 size-4 text-green-600 fill-green-600" />
                                                                <span>Love it</span>
                                                            </div>
                                                        )}
                                                        {item.arihants_rating === 1 && (
                                                            <div className="flex items-center">
                                                                <ThumbsUp className="mr-2 size-4 text-yellow-500 fill-yellow-500" />
                                                                <span>Like it</span>
                                                            </div>
                                                        )}
                                                        {item.arihants_rating === 0 && (
                                                            <div className="flex items-center">
                                                                <ThumbsDown className="mr-2 size-4 text-red-600 fill-red-600" />
                                                                <span>Dislike it</span>
                                                            </div>
                                                        )}
                                                        {item.arihants_rating === null && (
                                                            <div className="flex items-center">
                                                                <Minus className="mr-2 size-4" />
                                                                <span>No rating</span>
                                                            </div>
                                                        )}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="null">
                                                        <div className="flex items-center">
                                                            <Minus className="mr-2 size-4" />
                                                            <span>No rating</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="2">
                                                        <div className="flex items-center">
                                                            <ThumbsUp className="mr-2 size-4 text-green-600 fill-green-600" />
                                                            <span>Love it</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="1">
                                                        <div className="flex items-center">
                                                            <ThumbsUp className="mr-2 size-4 text-yellow-500 fill-yellow-500" />
                                                            <span>Like it</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="0">
                                                        <div className="flex items-center">
                                                            <ThumbsDown className="mr-2 size-4 text-red-600 fill-red-600" />
                                                            <span>Dislike it</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 border-2 border-dashed border-border rounded-md">
                            <p>No menu items found with the current filters.</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
};

export default CanteenAdminPage;
