"use client"

import React, { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useSession } from "next-auth/react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    read: boolean
    created_at: string
    data: any
}

export default function NotificationBell() {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const bellRef = useRef<HTMLButtonElement>(null)

    // Fetch notifications
    useEffect(() => {
        if (!session?.user?.rollNumber) return

        // Initial fetch
        fetchNotifications()

        // Subscribe to new notifications
        const channel = supabase
            .channel('notification_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${session.user.rollNumber}`
                },
                (payload) => {
                    // Add new notification to the list
                    const newNotification = payload.new as Notification
                    setNotifications(prev => [newNotification, ...prev])
                    setUnreadCount(prev => prev + 1)

                    // Show toast notification
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                        if (Notification.permission === 'granted') {
                            new Notification(newNotification.title, {
                                body: newNotification.message,
                                icon: '/android-chrome-192x192.png'
                            })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [session])

    const fetchNotifications = async () => {
        if (!session?.user?.rollNumber) return

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', session.user.rollNumber)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            console.error('Error fetching notifications:', error)
            return
        }

        setNotifications(data || [])
        setUnreadCount(data?.filter(n => !n.read).length || 0)
    }

    const markAsRead = async (id?: string) => {
        if (!session?.user?.rollNumber) return

        try {
            // Instead of updating, we'll delete the notifications
            let query = supabase
                .from('notifications')
                .delete()
                .eq('user_id', session.user.rollNumber)

            if (id) {
                // Delete specific notification
                query = query.eq('id', id)
            }

            const { error } = await query

            if (error) {
                console.error('Error deleting notifications:', error)
                return
            }

            // Update local state
            if (id) {
                // Remove the notification from state
                setNotifications(prev => prev.filter(n => n.id !== id))
                setUnreadCount(prev => Math.max(0, prev - 1))
            } else {
                // Remove all notifications
                setNotifications([])
                setUnreadCount(0)
            }
        } catch (error) {
            console.error('Error during notification deletion:', error)
        }
    }

    const requestNotificationPermission = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                await Notification.requestPermission()
            }
        }
    }

    // Request permission on component mount
    useEffect(() => {
        requestNotificationPermission()
    }, [])

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            markAsRead(notification.id)
        }

        // Navigate based on notification type
        if (notification.data?.listing_id) {
            window.location.href = `/mess/listings/${notification.data.listing_id}`
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={bellRef}
                    variant="noShadow"
                    size="icon"
                    className="relative"
                    aria-label="Notifications"
                >
                    <Bell className="h-[1.2rem] w-[1.2rem]" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 rounded-full bg-red-500 w-5 h-5 text-xs flex items-center justify-center text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 max-h-[400px] p-0 overflow-hidden flex flex-col"
                align="end"
            >
                <div className="p-3 border-b flex justify-between items-center">
                    <h3 className="font-bold">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="noShadow"
                            className="h-8 text-xs"
                            onClick={() => markAsRead()}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <div className="overflow-y-auto flex-1">
                    {notifications.length > 0 ? (
                        <div className="divide-y">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-3 cursor-pointer hover:bg-main/5",
                                        !notification.read && "bg-main/10"
                                    )}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {formatRelativeTime(notification.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1">{notification.message}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            <p>No notifications yet</p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
