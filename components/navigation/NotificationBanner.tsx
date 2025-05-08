"use client"

import React from "react"
import NotificationBell from "@/components/ui/notification-bell"
import { useSession } from "next-auth/react"

interface NotificationBannerProps {
    children: React.ReactNode
}

export default function NotificationBanner({ children }: NotificationBannerProps) {
    const { data: session } = useSession()

    // Only show notification bell if user is authenticated
    if (!session) {
        return <>{children}</>
    }

    return (
        <div className="fixed top-3 right-20 z-50 flex gap-2 items-center">
            <NotificationBell />
            {children}
        </div>
    )
}
