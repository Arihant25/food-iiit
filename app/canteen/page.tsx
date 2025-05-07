"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import Marquee from "@/components/ui/marquee"
import { isCanteenOpen } from "@/lib/utils";

interface Canteen {
  id: string;
  name: string;
  avatar_url: string | null;
  timings: string | null;
}

export default function CanteenPage() {
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);

  useEffect(() => {
    async function fetchCanteens() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from("canteens").select("*");

        if (error) {
          throw error;
        }

        if (data) {
          setCanteens(data as Canteen[]);
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

  const handleCanteenClick = (canteen: any) => {
    setSelectedCanteen(canteen);
    console.log(isCanteenOpen(canteen.timings));
    // Add logic to display the selected canteen's menu or details
    console.log("Selected canteen:", canteen);
  };

  return (
    <div className="relative p-6 pb-20 flex flex-col min-h-screen">
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
              WHERE WE EATING {new Date().getHours() >= 18 ? "TONIGHT" : "TODAY"}?
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