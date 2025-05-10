"use client";

import SwitchButton from "@/components/navigation/SwitchButton";
import AvatarBanner from "@/components/navigation/AvatarBanner";
import NotificationsPanel from "@/components/ui/notifications-panel";
import Marquee from "@/components/ui/marquee"
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { PageHeading } from "@/components/ui/page-heading"

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

            <PageHeading title="WHAT'S COOKING?" />

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