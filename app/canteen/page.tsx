"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import Marquee from "@/components/ui/marquee"
import { isCanteenOpen } from "@/lib/utils";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
  // Loading categories state removed

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

  const handleCanteenClick = (canteen: any) => {
    // Find the full canteen data from our canteens array using the id from the avatar click
    const fullCanteenData = canteens.find(c => c.id === canteen.id);

    if (fullCanteenData) {
      setSelectedCanteen(fullCanteenData);
    } else {
      console.error("Canteen data not found for id:", canteen.id);
    }
  };

  return (
    <div className="relative p-6 flex flex-col min-h-screen">
      <div className="mx-9 mr-18">
      </div>

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
          <div className="flex flex-col items-center mt-6 mb-12">
            <div className="border-4 border-black shadow-shadow bg-main text-main-foreground p-6 max-w-md w-full rounded-lg transform rotate-1">
              <h1 className="text-3xl font-heading text-center mb-4">{selectedCanteen.name}</h1>

              {selectedCanteen.timings && (
                <div className="flex flex-col items-center">
                  <p className="text-lg font-base mb-2">Hours: {selectedCanteen.timings}</p>
                  {isCanteenOpen(selectedCanteen.timings) ? (
                    <p className="text-xl font-heading px-3 py-1 bg-secondary-background rounded-md border-2 border-black">OPEN NOW</p>
                  ) : (
                    <p className="text-xl font-heading px-3 py-1 bg-background rounded-md border-2 border-black">CLOSED</p>
                  )}
                </div>
              )}
            </div>

            {/* Category Selection Dropdown */}
            <div className="mt-6 max-w-md w-full">
              <p className="text-lg font-semibold mb-2">Filter by category:</p>
              <Popover open={openCategoryDropdown} onOpenChange={setOpenCategoryDropdown}>
                <PopoverTrigger asChild>
                  <Button
                    variant="noShadow"
                    role="combobox"
                    aria-expanded={openCategoryDropdown}
                    className="w-full justify-between bg-main text-main-foreground border-2 border-black"
                  >
                    {selectedCategories.length > 0
                      ? selectedCategories.map((category) => category.label).join(", ")
                      : "Select categories..."}
                    <ChevronsUpDown className="text-muted-foreground" />
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
          </div>
        )}

        {!loading && !selectedCanteen && (
          <div className="flex flex-col gap-8">
            <Marquee items={canteens.map(canteen => canteen.name.toUpperCase())} />
            <Marquee items={canteens.map(canteen => canteen.name.toUpperCase())} />

            <div className="flex justify-center items-center m-12">
              <div className="text-5xl font-bold p-6 border-4 border-black bg-chart-1 text-main-foreground transform rotate-1 text-center max-w-md relative overflow-hidden"
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

            <Marquee items={canteens.map(canteen => canteen.name.toUpperCase())} />
            <Marquee items={canteens.map(canteen => canteen.name.toUpperCase())} />
          </div>
        )}
      </div>
    </div>
  );
}