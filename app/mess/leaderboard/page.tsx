"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeading } from "@/components/ui/page-heading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LeaderboardUser {
    id: string
    name: string
    count: number
}

export default function LeaderboardPage() {
    const [sellerStats, setSellerStats] = useState<LeaderboardUser[]>([])
    const [buyerStats, setBuyerStats] = useState<LeaderboardUser[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("sellers")
    const { data: session } = useSession()
    const currentUserId = session?.user?.rollNumber

    useEffect(() => {
        async function fetchLeaderboardData() {
            setIsLoading(true)
            try {
                // Type for the returned data
                type SellerDataItem = {
                    seller_id: string;
                    users: { name: string };
                }

                // Fetch seller data from transaction_history
                const { data: sellerData, error: sellerError } = await supabase
                    .from("transaction_history")
                    .select(`
            seller_id,
            users:users!transaction_history_seller_id_fkey (name)
          `)

                if (sellerError) {
                    console.error("Error fetching seller stats:", sellerError)
                    return
                }

                // Process seller data
                const sellerMap = new Map<string, { id: string; name: string; count: number }>()
                sellerData.forEach((item) => {
                    const sellerId = item.seller_id
                    // Type assertion to help TypeScript understand the structure
                    const users = item.users as unknown as { name: string }
                    const sellerName = users?.name || "Unknown"

                    if (sellerMap.has(sellerId)) {
                        sellerMap.get(sellerId)!.count += 1
                    } else {
                        sellerMap.set(sellerId, { id: sellerId, name: sellerName, count: 1 })
                    }
                })

                // Convert map to array and sort by count (descending)
                const processedSellerData = Array.from(sellerMap.values())
                    .sort((a, b) => b.count - a.count)

                setSellerStats(processedSellerData)

                // Fetch buyer data from transaction_history
                const { data: buyerData, error: buyerError } = await supabase
                    .from("transaction_history")
                    .select(`
            buyer_id,
            users:users!transaction_history_buyer_id_fkey (name)
          `)

                if (buyerError) {
                    console.error("Error fetching buyer stats:", buyerError)
                    return
                }

                // Process buyer data
                const buyerMap = new Map<string, { id: string; name: string; count: number }>()
                buyerData.forEach((item) => {
                    const buyerId = item.buyer_id
                    // Type assertion to help TypeScript understand the structure
                    const users = item.users as unknown as { name: string }
                    const buyerName = users?.name || "Unknown"

                    if (buyerMap.has(buyerId)) {
                        buyerMap.get(buyerId)!.count += 1
                    } else {
                        buyerMap.set(buyerId, { id: buyerId, name: buyerName, count: 1 })
                    }
                })

                // Convert map to array and sort by count (descending)
                const processedBuyerData = Array.from(buyerMap.values())
                    .sort((a, b) => b.count - a.count)

                setBuyerStats(processedBuyerData)
            } catch (error) {
                console.error("Error in fetchLeaderboardData:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLeaderboardData()
    }, [currentUserId])

    return (
        <div className="container mx-auto p-6 space-y-6">
            <PageHeading title="Leaderboard" subtitle="See who's most active on the platform" />

            {/* Mobile view with tabs */}
            <div className="md:hidden">
                <Tabs defaultValue="sellers" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="sellers">Top Sellers</TabsTrigger>
                        <TabsTrigger value="buyers">Top Buyers</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sellers" className="mt-4">
                        <LeaderboardTable
                            data={sellerStats}
                            isLoading={isLoading}
                            type="seller"
                            currentUserId={currentUserId}
                        />
                    </TabsContent>
                    <TabsContent value="buyers" className="mt-4">
                        <LeaderboardTable
                            data={buyerStats}
                            isLoading={isLoading}
                            type="buyer"
                            currentUserId={currentUserId}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Desktop view side by side */}
            <div className="hidden md:grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Top Sellers</h2>
                    <LeaderboardTable
                        data={sellerStats}
                        isLoading={isLoading}
                        type="seller"
                        currentUserId={currentUserId}
                    />
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Top Buyers</h2>
                    <LeaderboardTable
                        data={buyerStats}
                        isLoading={isLoading}
                        type="buyer"
                        currentUserId={currentUserId}
                    />
                </div>
            </div>
        </div>
    )
}

interface LeaderboardTableProps {
    data: LeaderboardUser[]
    isLoading: boolean
    type: 'seller' | 'buyer'
    currentUserId?: string
}

function LeaderboardTable({ data, isLoading, type, currentUserId }: LeaderboardTableProps) {
    const actionLabel = type === 'seller' ? 'Sales' : 'Purchases'

    if (isLoading) {
        return <div className="text-center py-8">Loading leaderboard data...</div>
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-8">
                No {type} statistics available yet.
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">{actionLabel}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((user, index) => {
                    // For debugging, check both exact match and case-insensitive match
                    const exactMatch = currentUserId && user.id === currentUserId
                    const caseInsensitiveMatch = currentUserId &&
                        String(user.id).toLowerCase() === String(currentUserId).toLowerCase()
                    const isCurrentUser = exactMatch || caseInsensitiveMatch

                    return (
                        <TableRow
                            key={user.id}
                            className={isCurrentUser ? "border-4 border-black font-bold" : ""}
                        >
                            <TableCell className="text-center font-medium">{index + 1}</TableCell>
                            <TableCell>{isCurrentUser ? "You" : user.name}</TableCell>
                            <TableCell className="text-right">{user.count}</TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    )
}