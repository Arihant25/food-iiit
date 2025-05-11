"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import NotificationsPanel from "@/components/ui/notifications-panel";
import Marquee from "@/components/ui/marquee"
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
        // If the clicked item is already selected (current path), redirect to the main mess page
        if (item.id === currentPath) {
            router.push('/mess');
        } else {
            router.push(`/mess/${item.id}`);
        }
    };

    const messes = [
        {
            id: "1",
            name: "North"
        },
        {
            id: "2",
            name: "South"
        },
        {
            id: "3",
            name: "Kadamba"
        },
        {
            id: "4",
            name: "Yuktahar"
        }
    ]

    return (
        <div className="px-6 py-4 flex flex-col justify-center min-h-screen">

            <div className="text-3xl sm:text-5xl font-bold p-2 sm:p-4 border-4 mb-6 border-black bg-chart-1 text-main-foreground transform rotate-1 text-center max-w-md relative overflow-hidden mx-auto self-center"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(0, 0, 0, 0.2) 1px, transparent 1px)`,
                    backgroundSize: `12px 12px`,
                    backgroundPosition: 'center',
                }}>
                <div className="relative z-10">
                    WHAT'S COOKING?
                </div>
            </div>

            <Marquee items={[...messes].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />

            <div className="my-6">
                <NotificationsPanel />
                <SwitchButton />
            </div>

            <Marquee items={[...messes].sort(() => 0.5 - Math.random()).map(canteen => canteen.name.toUpperCase())} />
            <AvatarBanner
                items={navigationItems}
                onAvatarClick={handleAvatarClick}
                selectedItemId={currentPath}
                isCanteen={false}
            />
        </div>
    );
}