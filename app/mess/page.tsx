"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function MessPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { status } = useSession();

    // Get the current path segment for highlighting the active icon
    const currentPath = pathname.split('/').pop() || "listings";

    // Redirect to home if not logged in
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    // Navigation items with external image URLs
    const navigationItems = [
        {
            id: "listings",
            name: "Listings",
            image: "https://cdn-icons-png.flaticon.com/512/4394/4394562.png"
        },
        {
            id: "analysis",
            name: "Analysis",
            image: "https://cdn-icons-png.flaticon.com/512/1011/1011528.png"
        },
        {
            id: "leaderboard",
            name: "Leaderboard",
            image: "https://cdn-icons-png.flaticon.com/512/2617/2617955.png"
        },
        {
            id: "profile",
            name: "Profile",
            image: "https://cdn-icons-png.flaticon.com/512/1077/1077012.png"
        }
    ];

    // Handle avatar click to navigate to the corresponding page
    const handleAvatarClick = (item: { id: string; name: string; image?: string | null }) => {
        router.push(`/mess/${item.id}`);
    };

    return (
        <div className="relative p-6">
            <div className="mx-9 ml-18">
                <h1 className="text-2xl font-bold mb-4">Mess</h1>

                {/* Content for mess page goes here */}
                <div className="p-4 bg-secondary-background rounded-lg border-2 border-border">
                    <p>Mess information and meal options will be displayed here.</p>
                </div>

                <SwitchButton />
            </div>
            <AvatarBanner
                items={navigationItems}
                onAvatarClick={handleAvatarClick}
                selectedItemId={currentPath}
                isCanteen={false}
            />
        </div>
    );
}