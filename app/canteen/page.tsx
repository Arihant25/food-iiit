"use client";

import { Switch } from "@/components/ui/switch";
import SwitchButton from "@/components/navigation/SwitchButton";
import { supabase, adminOperation } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import Marquee from "@/components/ui/marquee"
import { isCanteenOpen } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks";
import { ArrowDownAZ, ArrowUpZA, CheckIcon, ChevronsUpDown, SortAsc, Leaf, Drumstick, ThumbsUp, ThumbsDown, Search, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Canteen {
  id: string;
  name: string;
  avatar_url: string | null;
  timings: string | null;
}

interface Category {
  value: string;
  label: string;
}

export default function CanteenPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
  const [selectedSort, setSelectedSort] = useState<string>("none");
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<any[]>([]);
  const [isVeg, setIsVeg] = useState(false);
  const [isNonVeg, setIsNonVeg] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState("");
  const searchQuery = useDebounce(searchInputValue, 300);
  const [isVoting, setIsVoting] = useState(false);
  const userName = session?.user?.name || "Anonymous User";
  const [allCanteensMap, setAllCanteensMap] = useState<Record<string, Canteen>>({});

  // We'll track active subscriptions to clean them up when needed
  const [supabaseSubscription, setSupabaseSubscription] = useState<any>(null);

  // Redirect to home if not logged in
  // useEffect(() => {
  //   if (status === "unauthenticated") {
  //     router.push("/");
  //   }
  // }, [status, router]);

  useEffect(() => {
    async function fetchCanteens() {
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

          // Create a map of canteen IDs to canteen data for easy lookup
          const canteenMap: Record<string, Canteen> = {};
          sortedCanteens.forEach((canteen: Canteen) => {
            canteenMap[canteen.id] = canteen;
          });
          setAllCanteensMap(canteenMap);
        }
      } catch (error: any) {
        setError(error.message);
        console.error("Error fetching canteens:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCanteens();
  }, []);

  useEffect(() => {
    async function fetchCategories() {
      if (!selectedCanteen) {
        setCategories([]);
        setSelectedCategories([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("category")
          .eq("canteenid", selectedCanteen.id);

        if (error) {
          throw error;
        }

        if (data) {
          // Extract unique categories
          const uniqueCategories = [...new Set(data.map(item => item.category))];
          const formattedCategories = uniqueCategories
            .filter(category => category) // Filter out null/undefined values
            .map(category => ({
              value: category,
              label: category
            }));

          setCategories(formattedCategories);
        }
      } catch (error: any) {
        console.error("Error fetching categories:", error);
      }
    }

    fetchCategories();
  }, [selectedCanteen]);

  useEffect(() => {
    async function fetchMenuItems() {
      if (!selectedCanteen) {
        setMenuItems([]);
        setFilteredMenuItems([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("canteenid", selectedCanteen.id);

        if (error) {
          throw error;
        }

        if (data) {
          // The votes are now coming directly from the database
          setMenuItems(data);
          setFilteredMenuItems(data);
        }
      } catch (error: any) {
        console.error("Error fetching menu items:", error);
      }
    }

    fetchMenuItems();
  }, [selectedCanteen]);

  // Apply filtering and sorting whenever the filters change
  useEffect(() => {
    if (menuItems.length === 0) return;

    let result = [...menuItems];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      result = result.filter(item =>
        selectedCategories.some(cat => cat.value === item.category)
      );
    }

    // Apply vegetarian filter
    if (isVeg && !isNonVeg) {
      result = result.filter(item => !item.is_nonveg);
    }
    // Apply non-vegetarian filter
    else if (isNonVeg && !isVeg) {
      result = result.filter(item => item.is_nonveg);
    }
    // If both are true or both are false, don't filter by vegetarian status

    // Apply sorting
    switch (selectedSort) {
      case "a-z":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "z-a":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price":
        result.sort((a, b) => a.price - b.price);
        break;
      case "votes":
        // Sort by votes directly from the database
        result.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        break;
    }

    setFilteredMenuItems(result);
  }, [menuItems, selectedCategories, selectedSort, isVeg, isNonVeg, searchQuery]);

  // Set up Supabase real-time subscription for all canteens
  useEffect(() => {
    // Clean up any existing subscription when component re-mounts
    if (supabaseSubscription) {
      supabase.removeChannel(supabaseSubscription);
      setSupabaseSubscription(null);
    }

    // Create a global subscription for all menu items
    const channel = supabase
      .channel(`menu-votes-all-canteens`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'menu_items'
      }, (payload) => {
        const { new: updatedItem, old: oldItem } = payload;

        // Only update the menu items if we're looking at the canteen that was updated
        if (selectedCanteen && updatedItem.canteenid === selectedCanteen.id) {
          if (updatedItem.votes !== oldItem.votes) {
            setMenuItems(prevItems =>
              prevItems.map(item =>
                item.id === updatedItem.id ? { ...item, votes: updatedItem.votes } : item
              )
            );
          }
        }

        // Show toast notifications for all canteens
        if (updatedItem.last_voter && updatedItem.last_voter !== userName) {
          const voteType = updatedItem.last_vote_type === 'liked' ? 'liked' : 'disliked';

          // Find which canteen this menu item belongs to
          const canteenName = allCanteensMap[updatedItem.canteenid]?.name || 'Unknown Canteen';

          // Extract first name from last_voter
          const firstName = updatedItem.last_voter.split(' ')[0];

          toast(`${firstName} ${voteType} ${updatedItem.name} at ${canteenName}`, {
            position: "bottom-right",
            duration: 4000,
          });
        }
      });

    // Subscribe to the channel
    channel.subscribe();

    // Save the subscription
    setSupabaseSubscription(channel);

    // Clean up subscription when component unmounts
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [selectedCanteen, userName, allCanteensMap]);

  const handleCanteenClick = (canteen: any) => {
    // Find the full canteen data from our canteens array using the id from the avatar click
    const fullCanteenData = canteens.find(c => c.id === canteen.id);

    if (fullCanteenData) {
      // Reset all filters when changing canteen
      setSelectedCategories([]);
      setSelectedSort("none");
      setSearchInputValue(""); // Update this line to use setSearchInputValue instead of setSearchQuery
      setIsVeg(false);
      setIsNonVeg(false);
      setSelectedCanteen(fullCanteenData);
    } else {
      console.error("Canteen data not found for id:", canteen.id);
    }
  };

  const handleVote = async (itemId: string, value: number) => {
    if (isVoting) return; // Prevent multiple simultaneous votes

    if (!session?.user) {
      toast.error("You need to be logged in to vote");
      const router = useRouter();
      router.push("/");
      return;
    }

    try {
      setIsVoting(true);

      // Use the adminOperation function to handle the vote
      const result = await adminOperation(async (client) => {
        // First get the current item to get its current votes
        const { data: currentItem, error: fetchError } = await client
          .from("menu_items")
          .select("votes, name")
          .eq("id", itemId)
          .single();

        if (fetchError) {
          console.error("Error fetching current item:", fetchError);
          throw fetchError;
        }

        // Calculate new vote count (use 0 as default if votes is null)
        const currentVotes = currentItem.votes || 0;
        const newVotes = currentVotes + value;

        // Update the votes in the database
        const { data: updateData, error: updateError } = await client
          .from("menu_items")
          .update({
            votes: newVotes,
            last_voter: userName,
            last_vote_type: value > 0 ? 'liked' : 'disliked',
            last_vote_timestamp: new Date().toISOString()
          })
          .eq("id", itemId)
          .select();

        if (updateError) {
          console.error("Error updating votes:", updateError);
          throw updateError;
        }

        return { currentItem, newVotes, updateData };
      });

      // Update the local state to reflect the change
      if (result) {
        setMenuItems(menuItems.map(item =>
          item.id === itemId ? { ...item, votes: result.newVotes } : item
        ));

        // Update filtered items as well
        setFilteredMenuItems(filteredMenuItems.map(item =>
          item.id === itemId ? { ...item, votes: result.newVotes } : item
        ));

        // Show toast confirmation
        const actionType = value > 0 ? "upvoted" : "downvoted";
        const itemName = result.currentItem.name;
        toast.success(`You ${actionType} "${itemName}"`, {
          position: "bottom-right",
          duration: 3000,
        });
      }

    } catch (error: any) {
      console.error("Error in voting process:", error);
      toast.error("Failed to register your vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="relative p-2 sm:p-6 flex flex-col min-h-screen">
      <div className="mx-2 mr-14 mb-10">

        <SwitchButton />

        <div className="flex-grow flex flex-col justify-center">
          {!loading && canteens.length > 0 && (
            <AvatarBanner
              items={canteens.map(canteen => ({
                id: canteen.id,
                name: canteen.name,
                image: canteen.avatar_url
              }))}
              onAvatarClick={handleCanteenClick}
              selectedItemId={selectedCanteen?.id}
            />
          )}

          {selectedCanteen && (
            <div className="flex flex-col items-center mt-4 sm:mt-6 mb-8 sm:mb-12">
              <div className="border-4 border-black shadow-shadow bg-main text-main-foreground p-4 w-full max-w-md rounded-lg transform rotate-1">
                <h1 className="text-4xl sm:text-5xl font-heading text-center mb-4">{selectedCanteen.name}</h1>

                {selectedCanteen.timings && (
                  <div className="flex flex-col items-center">
                    <p className="text-base sm:text-lg font-base mb-2">Hours: {selectedCanteen.timings}</p>
                    {isCanteenOpen(selectedCanteen.timings) ? (
                      <p className="text-lg sm:text-xl font-heading px-3 py-1 bg-secondary-background rounded-md border-2 border-black">OPEN NOW</p>
                    ) : (
                      <p className="text-lg sm:text-xl font-heading px-3 py-1 bg-background rounded-md border-2 border-black">CLOSED</p>
                    )}
                  </div>
                )}
              </div>

              {/* Filters Section */}
              <div className="flex flex-col mt-6 sm:mt-8 mb-4 w-full max-w-4xl mx-auto bg-secondary-background rounded-lg p-3 sm:p-6 border-2 border-border">
                <h2 className="text-lg sm:text-xl font-heading mb-3 sm:mb-4 text-center">Filters & Search</h2>

                {/* Search input */}
                <div className="mb-3 sm:mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 size-4 sm:size-5" />
                    <Input
                      placeholder="Search menu items..."
                      value={searchInputValue}
                      onChange={(e) => setSearchInputValue(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Category Selection Dropdown */}
                  <div className="w-full sm:flex-1">
                    <p className="text-sm font-medium mb-1">Filter by category:</p>
                    <Popover open={openCategoryDropdown} onOpenChange={setOpenCategoryDropdown}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="noShadow"
                          role="combobox"
                          aria-expanded={openCategoryDropdown}
                          className="w-full justify-between bg-main text-main-foreground border-2 border-black"
                        >
                          {selectedCategories.length > 0
                            ? selectedCategories.length > 1
                              ? `${selectedCategories.length} categories selected`
                              : selectedCategories[0].label
                            : "Select categories..."}
                          <ChevronsUpDown className="ml-1 text-muted-foreground size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 border-0" align="start">
                        <Command className="**:data-[slot=command-input-wrapper]:h-11">
                          <CommandInput placeholder="Search categories..." />
                          <CommandList>
                            <CommandEmpty>No categories found.</CommandEmpty>
                            <CommandGroup className="p-2 [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1">
                              {categories.map((category) => (
                                <CommandItem
                                  key={category.value}
                                  value={category.value}
                                  onSelect={(currentValue) => {
                                    setSelectedCategories(
                                      selectedCategories.some((c) => c.value === currentValue)
                                        ? selectedCategories.filter(
                                          (c) => c.value !== currentValue,
                                        )
                                        : [...selectedCategories, category],
                                    )
                                  }}
                                >
                                  <div
                                    className="border-border pointer-events-none size-5 shrink-0 rounded-base border-2 transition-all select-none *:[svg]:opacity-0 data-[selected=true]:*:[svg]:opacity-100"
                                    data-selected={selectedCategories.some(
                                      (c) => c.value === category.value,
                                    )}
                                  >
                                    <CheckIcon className="size-4 text-current" />
                                  </div>
                                  {category.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="w-full sm:flex-1">
                    <p className="text-sm font-medium mb-1">Sort by:</p>
                    <Select value={selectedSort} onValueChange={setSelectedSort}>
                      <SelectTrigger className="w-full bg-main text-main-foreground border-2 border-black">
                        <SelectValue placeholder="Sort options..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No sorting</SelectItem>
                        <SelectItem value="a-z">
                          <div className="flex items-center gap-2">
                            <ArrowDownAZ className="size-4" />
                            <span>Sort A-Z</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="z-a">
                          <div className="flex items-center gap-2">
                            <ArrowUpZA className="size-4" />
                            <span>Sort Z-A</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="price">
                          <div className="flex items-center gap-2">
                            <SortAsc className="size-4" />
                            <span>Sort by Price</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="votes">
                          <div className="flex items-center gap-2">
                            <ThumbsUp className="size-4" />
                            <span>Sort by Popularity</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Vegetarian/Non-vegetarian switches */}
                <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-4 sm:gap-8">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="veg-mode"
                      checked={isVeg}
                      onCheckedChange={setIsVeg}
                    />
                    <label htmlFor="veg-mode" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <Leaf className="size-4 text-green-600" />
                      <span>Veg</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="non-veg-mode"
                      checked={isNonVeg}
                      onCheckedChange={setIsNonVeg}
                    />
                    <label htmlFor="non-veg-mode" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <Drumstick className="size-4 text-red-600" />
                      <span>Non-Veg</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Menu Items Display */}
              <div className="w-full max-w-4xl">
                {filteredMenuItems.length > 0 ? (
                  <div className="space-y-8">
                    {/* Group items by category */}
                    {Array.from(new Set(filteredMenuItems.map(item => item.category))).sort().map(category => (
                      <div key={category} className="space-y-4">
                        <h2 className="text-2xl sm:text-3xl font-bold text-center border-b-4 border-border pb-2 my-12 mb-8">{category}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          {filteredMenuItems
                            .filter(item => item.category === category)
                            .map((item) => (
                              <Card key={item.id} className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center p-1 rounded-r-md">
                                  <Button
                                    variant="noShadow"
                                    size="icon"
                                    onClick={() => handleVote(item.id, 1)}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                    disabled={isVoting}
                                  >
                                    ▲
                                  </Button>
                                  <span className="text-md sm:text-lg font-bold">{item.votes || 0}</span>
                                  <Button
                                    variant="noShadow"
                                    size="icon"
                                    onClick={() => handleVote(item.id, -1)}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                    disabled={isVoting}
                                  >
                                    ▼
                                  </Button>
                                </div>

                                <div className="ml-10 flex">
                                  <div className="flex-1">
                                    <CardHeader className="p-3 sm:p-6">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <CardTitle className="text-base sm:text-lg">
                                          <div className="flex items-center gap-2">
                                            {item.name}
                                            {item.is_nonveg ?
                                              <Drumstick className="size-4 text-red-600" /> :
                                              <Leaf className="size-4 text-green-600" />
                                            }
                                          </div>
                                        </CardTitle>
                                        <div className="font-bold text-base sm:text-lg">₹{item.price.toFixed(2)}</div>
                                      </div>
                                    </CardHeader>

                                    {item.description && (
                                      <CardContent className="p-3 sm:p-6 pt-0">
                                        <p className="text-xs sm:text-sm">{item.description}</p>
                                      </CardContent>
                                    )}
                                  </div>

                                  <div className="w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center bg-secondary-background/50 rounded-md border border-border mx-2 sm:mx-4 my-auto overflow-hidden">
                                    {/* Placeholder for food image */}
                                    <div className="text-xs text-center text-foreground/60">Food Image</div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 sm:p-8 border-2 border-dashed border-border rounded-base">
                    <p>No menu items found with the selected filters.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!loading && !selectedCanteen && (
          <div className="flex flex-col gap-4 sm:gap-8 justify-center items-center min-h-[50vh]">
            <Marquee items={[...canteens].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />
            <Marquee items={[...canteens].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />

            <div className="flex justify-center items-center my-auto py-8 sm:py-12">
              <div className="text-3xl sm:text-5xl font-bold p-4 sm:p-6 border-4 border-black bg-chart-1 text-main-foreground transform rotate-1 text-center max-w-md relative overflow-hidden"
                style={{
                  backgroundImage: `radial-gradient(circle, rgba(0, 0, 0, 0.2) 1px, transparent 1px)`,
                  backgroundSize: `12px 12px`,
                  backgroundPosition: 'center',
                }}>
                <div className="relative z-10">
                  WHERE WE EATING {new Date().getHours() >= 19 ? "TONIGHT" : "TODAY"}?
                </div>
              </div>
            </div>

            <Marquee items={[...canteens].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />
            <Marquee items={[...canteens].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />
          </div>
        )}
      </div>
    </div>
  );
}