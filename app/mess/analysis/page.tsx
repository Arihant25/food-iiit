"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { supabase } from "@/lib/supabaseClient"
import { format, subDays, parseISO } from "date-fns"
import {
    ShoppingBag,
    Receipt,
    Wallet,
    CreditCard,
} from "lucide-react"

import {
    ChartContainer,
    ChartLegend,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    PieChart as RechartPieChart,
    Pie,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    Cell
} from "@/components/ui/chart"

import { PageHeading } from "@/components/ui/page-heading"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// Types
interface TransactionSummary {
    totalPurchases: number
    totalSales: number
    totalExpenses: number
    totalEarnings: number
    averagePurchasePrice: number
    averageSalePrice: number
}

interface DailyTransactionCount {
    date: string
    count: number
}

interface MealSummary {
    meal: string
    count: number
}

interface MessSummary {
    mess: string
    count: number
    revenue: number
}

interface MealPriceTrend {
    date: string
    price: number
    meal: string
    mess: string
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function AnalysisPage() {
    const { data: session } = useSession()
    const currentUserId = session?.user?.rollNumber

    // State for personal analytics
    const [userSummary, setUserSummary] = useState<TransactionSummary>({
        totalPurchases: 0,
        totalSales: 0,
        totalExpenses: 0,
        totalEarnings: 0,
        averagePurchasePrice: 0,
        averageSalePrice: 0
    })

    // State for overall analytics
    const [dailyTransactions, setDailyTransactions] = useState<DailyTransactionCount[]>([])
    const [popularMeals, setPopularMeals] = useState<MealSummary[]>([])
    const [messSales, setMessSales] = useState<MessSummary[]>([])
    const [mealPriceTrends, setMealPriceTrends] = useState<MealPriceTrend[]>([])

    // State for filters
    const [selectedMess, setSelectedMess] = useState<string>("All")
    const [selectedMeal, setSelectedMeal] = useState<string>("All")
    const [isLoading, setIsLoading] = useState(true)
    const [availableMesses, setAvailableMesses] = useState<string[]>([])
    const [availableMeals, setAvailableMeals] = useState<string[]>([])

    useEffect(() => {
        if (!currentUserId) return

        async function fetchData() {
            setIsLoading(true)
            try {
                // Fetch user's personal transaction data
                if (currentUserId) {
                    await fetchUserSummary(currentUserId)
                }

                // Fetch overall analytics data
                await fetchDailyTransactions()
                await fetchPopularMeals()
                await fetchMessSales()
                await fetchMealPriceTrends()

                // Get unique messes and meals for filters
                await fetchAvailableFilters()
            } catch (error) {
                console.error("Error fetching analysis data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [currentUserId])

    const fetchUserSummary = async (userId: string) => {
        // Fetch user's purchases
        const { data: purchases, error: purchasesError } = await supabase
            .from("transaction_history")
            .select("sold_price")
            .eq("buyer_id", userId)

        if (purchasesError) {
            console.error("Error fetching user purchases:", purchasesError)
            return
        }

        // Fetch user's sales
        const { data: sales, error: salesError } = await supabase
            .from("transaction_history")
            .select("sold_price, listing_price")
            .eq("seller_id", userId)

        if (salesError) {
            console.error("Error fetching user sales:", salesError)
            return
        }

        // Calculate summary
        const totalPurchases = purchases.length
        const totalSales = sales.length
        const totalExpenses = purchases.reduce((sum, item) => sum + Number(item.sold_price), 0)
        const totalEarnings = sales.reduce((sum, item) => sum + Number(item.sold_price), 0)
        const averagePurchasePrice = totalPurchases > 0 ? totalExpenses / totalPurchases : 0
        const averageSalePrice = totalSales > 0 ? totalEarnings / totalSales : 0

        setUserSummary({
            totalPurchases,
            totalSales,
            totalExpenses,
            totalEarnings,
            averagePurchasePrice,
            averageSalePrice
        })
    }

    const fetchDailyTransactions = async () => {
        // Get data for the last 30 days
        const { data, error } = await supabase
            .from("transaction_history")
            .select("date_of_transaction")
            .order("date_of_transaction", { ascending: false })

        if (error) {
            console.error("Error fetching daily transactions:", error)
            return
        }

        // Group by date and count
        const counts = data.reduce((acc: Record<string, number>, item) => {
            const date = item.date_of_transaction
            acc[date] = (acc[date] || 0) + 1
            return acc
        }, {})

        // Fill in missing dates with zeros
        const today = new Date()
        const dailyCounts: DailyTransactionCount[] = []

        for (let i = 29; i >= 0; i--) {
            const date = format(subDays(today, i), "yyyy-MM-dd")
            dailyCounts.push({
                date,
                count: counts[date] || 0
            })
        }

        setDailyTransactions(dailyCounts)
    }

    const fetchPopularMeals = async () => {
        const { data, error } = await supabase
            .from("transaction_history")
            .select("meal")
            .not("meal", "is", null)

        if (error) {
            console.error("Error fetching popular meals:", error)
            return
        }

        // Count occurrences of each meal
        const mealCounts: Record<string, number> = {}
        data.forEach(item => {
            const meal = item.meal
            mealCounts[meal] = (mealCounts[meal] || 0) + 1
        })

        // Convert to array and sort
        const formattedData = Object.entries(mealCounts)
            .map(([meal, count]) => ({ meal, count }))
            .sort((a, b) => b.count - a.count)

        setPopularMeals(formattedData.slice(0, 10))
    }

    const fetchMessSales = async () => {
        const { data, error } = await supabase
            .from("transaction_history")
            .select("mess, sold_price")
            .not("mess", "is", null)

        if (error) {
            console.error("Error fetching mess sales:", error)
            return
        }

        // Group and aggregate by mess
        const messMap = new Map<string, { count: number, revenue: number }>()

        data.forEach(item => {
            const mess = item.mess
            const price = Number(item.sold_price)

            if (!messMap.has(mess)) {
                messMap.set(mess, { count: 0, revenue: 0 })
            }

            const current = messMap.get(mess)!
            current.count += 1
            current.revenue += price
            messMap.set(mess, current)
        })

        const formattedData = Array.from(messMap.entries()).map(([mess, stats]) => ({
            mess,
            count: stats.count,
            revenue: stats.revenue
        }))

        setMessSales(formattedData)
    }

    const fetchMealPriceTrends = async () => {
        const { data, error } = await supabase
            .from("transaction_history")
            .select("date_of_transaction, sold_price, meal, mess")
            .order("date_of_transaction", { ascending: true })

        if (error) {
            console.error("Error fetching meal price trends:", error)
            return
        }

        const formattedData = data.map(item => ({
            date: item.date_of_transaction,
            price: Number(item.sold_price),
            meal: item.meal,
            mess: item.mess
        }))

        setMealPriceTrends(formattedData)
    }

    const fetchAvailableFilters = async () => {
        // Fetch unique messes
        const { data: messData, error: messError } = await supabase
            .from("transaction_history")
            .select("mess")
            .not("mess", "is", null)
            .order("mess")

        if (messError) {
            console.error("Error fetching messes:", messError)
            return
        }

        const uniqueMesses = Array.from(new Set(messData.map(item => item.mess)))
        setAvailableMesses(uniqueMesses)

        // Fetch unique meals
        const { data: mealData, error: mealError } = await supabase
            .from("transaction_history")
            .select("meal")
            .not("meal", "is", null)
            .order("meal")

        if (mealError) {
            console.error("Error fetching meals:", mealError)
            return
        }

        const uniqueMeals = Array.from(new Set(mealData.map(item => item.meal)))
        setAvailableMeals(uniqueMeals)
    }

    // Filter meal price trends based on selected mess and meal
    const filteredMealPriceTrends = useMemo(() => {
        return mealPriceTrends.filter(item => {
            const messMatch = selectedMess === "All" || item.mess === selectedMess
            const mealMatch = selectedMeal === "All" || item.meal === selectedMeal
            return messMatch && mealMatch
        })
    }, [mealPriceTrends, selectedMess, selectedMeal])

    // Calculate average prices by date for the filtered data
    const averagePricesByDate = useMemo(() => {
        const pricesByDate = filteredMealPriceTrends.reduce((acc: Record<string, { total: number, count: number }>, item) => {
            if (!acc[item.date]) {
                acc[item.date] = { total: 0, count: 0 }
            }
            acc[item.date].total += item.price
            acc[item.date].count += 1
            return acc
        }, {})

        return Object.entries(pricesByDate).map(([date, stats]) => ({
            date,
            price: stats.count > 0 ? stats.total / stats.count : 0
        })).sort((a, b) => a.date.localeCompare(b.date))
    }, [filteredMealPriceTrends])

    if (isLoading) {
        return <div className="container mx-auto p-6">Loading analysis data...</div>
    }

    return (
        <div className="container mx-auto sm:px-4 md:px-6 p-6 md:py-6 space-y-6 md:space-y-8">
            <PageHeading
                title="Analysis"
                subtitle="No one asked for this, and yet here we are"
            />

            <Tabs defaultValue="personal" className="space-y-4 md:space-y-6">
                <TabsList className="grid w-full max-w-xs sm:max-w-md mx-auto grid-cols-2">
                    <TabsTrigger value="personal">Personal Analytics</TabsTrigger>
                    <TabsTrigger value="overall">Overall Analytics</TabsTrigger>
                </TabsList>

                {/* Personal Analytics Tab */}
                <TabsContent value="personal" className="space-y-6">
                    <h2 className="text-2xl font-bold">Your Transaction Summary</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Purchases Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{userSummary.totalPurchases}</div>
                                <p className="text-xs text-muted-foreground">
                                    Avg. ₹{userSummary.averagePurchasePrice.toFixed(2)} per purchase
                                </p>
                            </CardContent>
                        </Card>

                        {/* Sales Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                                <Receipt className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{userSummary.totalSales}</div>
                                <p className="text-xs text-muted-foreground">
                                    Avg. ₹{userSummary.averageSalePrice.toFixed(2)} per sale
                                </p>
                            </CardContent>
                        </Card>

                        {/* Expenses Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">₹{userSummary.totalExpenses.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">
                                    From {userSummary.totalPurchases} purchases
                                </p>
                            </CardContent>
                        </Card>

                        {/* Earnings Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">₹{userSummary.totalEarnings.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">
                                    From {userSummary.totalSales} sales
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Visual representation of purchases vs sales */}
                    <Card className="p-2 sm:p-4">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle>Your Activity Summary</CardTitle>
                            <CardDescription>
                                Comparison of your purchases and sales
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                            <ChartContainer
                                className="h-full"
                                config={{
                                    purchases: { color: "#0088FE" },
                                    sales: { color: "#00C49F" },
                                    expenses: { color: "#FFBB28" },
                                    earnings: { color: "#FF8042" }
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartPieChart>
                                        <Pie
                                            data={[
                                                { name: 'Purchases', value: userSummary.totalPurchases, dataKey: 'purchases' },
                                                { name: 'Sales', value: userSummary.totalSales, dataKey: 'sales' }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {[0, 1].map((index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <ChartLegend verticalAlign="bottom" />
                                    </RechartPieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Overall Analytics Tab */}
                <TabsContent value="overall" className="space-y-6">
                    {/* Daily Transactions Line Chart */}
                    <Card className="p-2 sm:p-4">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle>Daily Transactions</CardTitle>
                            <CardDescription>Number of meals sold per day (last 30 days)</CardDescription>
                        </CardHeader>
                        <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                            <ChartContainer
                                className="h-full"
                                config={{
                                    transactions: { color: "#0088FE" },
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={dailyTransactions}
                                        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(date) => format(parseISO(date), "MMM dd")}
                                            tick={{ fontSize: '10px' }}
                                            tickCount={5}
                                        />
                                        <YAxis
                                            width={25}
                                            tick={{ fontSize: '10px' }}
                                        />
                                        <Tooltip
                                            labelFormatter={(date) => format(parseISO(date), "MMMM dd, yyyy")}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            name="Transactions"
                                            activeDot={{ r: 6 }}
                                            stroke="#0088FE"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {/* Popular Meals Pie Chart */}
                        <Card className="p-2 sm:p-4">
                            <CardHeader className="p-3 sm:p-4">
                                <CardTitle>Most Popular Meals</CardTitle>
                                <CardDescription>Top meals by number of transactions</CardDescription>
                            </CardHeader>
                            <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                                <ChartContainer
                                    className="h-full"
                                    config={popularMeals.reduce((acc, item, index) => {
                                        acc[item.meal] = { color: COLORS[index % COLORS.length] }
                                        return acc
                                    }, {} as Record<string, { color: string }>)}
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartPieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                            <Pie
                                                data={popularMeals.slice(0, 5)}
                                                nameKey="meal"
                                                dataKey="count"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={60}
                                                innerRadius={30}
                                                labelLine={false}
                                                label={(entry) => entry.meal.length > 10 ? `${entry.meal.substring(0, 8)}...` : entry.meal}
                                            >
                                                {popularMeals.slice(0, 5).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <ChartLegend verticalAlign="bottom" />
                                        </RechartPieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>

                        {/* Mess Sales Bar Chart */}
                        <Card className="p-2 sm:p-4">
                            <CardHeader className="p-3 sm:p-4">
                                <CardTitle>Mess Performance</CardTitle>
                                <CardDescription>Total sales by mess</CardDescription>
                            </CardHeader>
                            <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                                <ChartContainer
                                    className="h-full"
                                    config={{
                                        sales: { color: "#0088FE" },
                                    }}
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={messSales}
                                            margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="mess"
                                                tick={{ fontSize: '10px' }}
                                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 8)}...` : value}
                                            />
                                            <YAxis tick={{ fontSize: '10px' }} width={25} />
                                            <Tooltip />
                                            <Bar
                                                dataKey="count"
                                                name="Number of Sales"
                                                fill="#0088FE"
                                                radius={[4, 4, 0, 0]}
                                                barSize={30}
                                            >
                                                {messSales.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Meal Price Trends Over Time (with filters) */}
                    <Card className="p-2 sm:p-4">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle>Meal Price Trends</CardTitle>
                            <CardDescription>Average price over time</CardDescription>
                        </CardHeader>
                        <div className="px-3 sm:px-6 py-1 sm:py-2 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1 sm:space-y-2">
                                <Label htmlFor="mess-select" className="text-xs sm:text-sm">Select Mess</Label>
                                <Select
                                    value={selectedMess}
                                    onValueChange={setSelectedMess}
                                >
                                    <SelectTrigger id="mess-select" className="h-8 text-xs sm:h-9 sm:text-sm">
                                        <SelectValue placeholder="Select Mess" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Messes</SelectItem>
                                        {availableMesses.map((mess) => (
                                            <SelectItem key={mess} value={mess}>
                                                {mess}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                                <Label htmlFor="meal-select" className="text-xs sm:text-sm">Select Meal</Label>
                                <Select
                                    value={selectedMeal}
                                    onValueChange={setSelectedMeal}
                                >
                                    <SelectTrigger id="meal-select" className="h-8 text-xs sm:h-9 sm:text-sm">
                                        <SelectValue placeholder="Select Meal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Meals</SelectItem>
                                        {availableMeals.map((meal) => (
                                            <SelectItem key={meal} value={meal}>
                                                {meal}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                            <ChartContainer
                                className="h-full"
                                config={{
                                    prices: { color: "#FF8042" },
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={averagePricesByDate}
                                        margin={{ top: 10, right: 10, bottom: 5, left: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(date) => format(parseISO(date), "MMM dd")}
                                            tick={{ fontSize: '10px' }}
                                            tickCount={5}
                                        />
                                        <YAxis
                                            width={30}
                                            tick={{ fontSize: '10px' }}
                                            tickFormatter={(value) => `₹${value}`}
                                        />
                                        <Tooltip
                                            labelFormatter={(date) => format(parseISO(date), "MMMM dd, yyyy")}
                                            formatter={(value) => [`₹${Number(value).toFixed(2)}`, "Average Price"]}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="price"
                                            name="Price"
                                            stroke="#FF8042"
                                            strokeWidth={2}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                        <CardFooter className="px-4 py-2 text-xs sm:text-sm text-muted-foreground">
                            {selectedMess === "All" && selectedMeal === "All"
                                ? "Showing average price for all meals across all messes"
                                : `Showing average price for ${selectedMeal === "All" ? "all meals" : selectedMeal} at ${selectedMess === "All" ? "all messes" : selectedMess}`}
                        </CardFooter>
                    </Card>

                    {/* Revenue by Mess Bar Chart */}
                    <Card className="p-2 sm:p-4">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle>Mess Revenue</CardTitle>
                            <CardDescription>Total revenue by mess</CardDescription>
                        </CardHeader>
                        <CardContent className="h-60 sm:h-72 md:h-80 p-0 sm:p-1">
                            <ChartContainer
                                className="h-full"
                                config={{
                                    revenue: { color: "#8884d8" },
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={messSales}
                                        margin={{ top: 10, right: 10, bottom: 10, left: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="mess"
                                            tick={{ fontSize: '10px' }}
                                            tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                                        />
                                        <YAxis
                                            width={40}
                                            tick={{ fontSize: '10px' }}
                                            tickFormatter={(value) => `₹${value}`}
                                        />
                                        <Tooltip formatter={(value) => [`₹${Number(value).toFixed(2)}`, "Revenue"]} />
                                        <Bar
                                            dataKey="revenue"
                                            name="Revenue"
                                            fill="#8884d8"
                                            radius={[4, 4, 0, 0]}
                                            barSize={30}
                                        >
                                            {messSales.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}