"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn, formatRelativeTime } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    read: boolean
    created_at: string
    data: any
}

export default function NotificationsPanel() {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const router = useRouter()

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

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center gap-4">
                    <CardTitle className="text-xl truncate">Notifications</CardTitle>
                    {unreadCount > 0 && (
                        <Button
                            variant="default"
                            className="h-8 text-xs shrink-0"
                            onClick={() => markAsRead()}
                        >
                            Clear all
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                    {notifications.length > 0 ? (
                        <div className="divide-y">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "py-3 hover:bg-main/5 rounded-md transition-colors",
                                        !notification.read && "bg-main/10",
                                        notification.type === 'payment_marked' && "cursor-pointer hover:shadow-sm"
                                    )}
                                    onClick={() => {
                                        // Navigate to purchases tab for payment_marked notifications
                                        if (notification.type === 'payment_marked') {
                                            router.push('/mess/dashboard?tab=purchased');
                                            markAsRead(notification.id);
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {formatRelativeTime(notification.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1">
                                        {notification.message}
                                        {notification.type === 'payment_marked' && (
                                            <span className="ml-1">Tap to view QR.</span>
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            <p>Your notifications will appear here... when you have any.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
