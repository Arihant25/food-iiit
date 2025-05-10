"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface Transaction {
    id: string
    date_of_transaction: string
    meal: string
    mess: string
    sold_price: number
    listing_price: number
    buyer_id: string
    seller_id: string
    listing_created_at: string
    sold_time: string
    time_gap: string
    buyer_name?: string
    seller_name?: string
}

interface DataTableProps {
    data: Transaction[]
    userRollNumber: string
}

export function TransactionsTable({ data, userRollNumber }: DataTableProps) {
    const router = useRouter()
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

    // Format date to show "28th May (Tue)"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    // Format price to INR
    const formatPrice = (price: number | undefined) => {
        if (!price) return "N/A"
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(price)
    }

    // Format time gap to be more human readable
    const formatTimeGap = (timeGap: string) => {
        // PostgreSQL interval format: "hh:mm:ss.ms" or with days "dd days hh:mm:ss.ms"
        if (!timeGap) return "N/A"

        if (timeGap.includes("days")) {
            const parts = timeGap.split(" days ")
            const days = parseInt(parts[0])

            if (days === 0) {
                return formatHoursMinutes(parts[1])
            } else if (days === 1) {
                return "1 day " + formatHoursMinutes(parts[1])
            } else {
                return `${days} days ` + formatHoursMinutes(parts[1])
            }
        } else {
            return formatHoursMinutes(timeGap)
        }
    }

    const formatHoursMinutes = (timeString: string) => {
        const timeParts = timeString.split(":")
        const hours = parseInt(timeParts[0])
        const minutes = parseInt(timeParts[1])

        if (hours === 0) {
            return minutes === 1 ? "1 minute" : `${minutes} minutes`
        } else if (hours === 1) {
            return "1 hour" + (minutes > 0 ? ` ${minutes} min` : "")
        } else {
            return `${hours} hours` + (minutes > 0 ? ` ${minutes} min` : "")
        }
    }

    // Format meal type for consistency
    const formatMeal = (meal: string) => {
        return meal.charAt(0).toUpperCase() + meal.slice(1).toLowerCase()
    }

    const columns: ColumnDef<Transaction>[] = [
        {
            accessorKey: "date_of_transaction",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div>{formatDate(row.getValue("date_of_transaction"))}</div>,
        },
        {
            accessorKey: "meal",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Meal
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div>{formatMeal(row.getValue("meal"))}</div>,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            accessorKey: "mess",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Mess
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            accessorKey: "listing_price",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Listed Price
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div>{formatPrice(row.getValue("listing_price"))}</div>,
        },
        {
            accessorKey: "sold_price",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Sold Price
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => (
                <div className="font-medium">{formatPrice(row.getValue("sold_price"))}</div>
            ),
        },
        {
            accessorKey: "role",
            header: "Role",
            cell: ({ row }) => {
                const isUserBuyer = row.original.buyer_id === userRollNumber
                return (
                    <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isUserBuyer ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {isUserBuyer ? "Buyer" : "Seller"}
                        </span>
                    </div>
                )
            },
            filterFn: (row, id, value) => {
                const isUserBuyer = row.original.buyer_id === userRollNumber
                const role = isUserBuyer ? "buyer" : "seller"
                return value.includes(role)
            },
        },
        {
            accessorKey: "other_party",
            header: "Other Party",
            cell: ({ row }) => {
                const isUserBuyer = row.original.buyer_id === userRollNumber
                return <div>{isUserBuyer ? row.original.seller_name : row.original.buyer_name}</div>
            },
        },
        {
            accessorKey: "time_gap",
            header: ({ column }) => {
                return (
                    <Button
                        variant="neutral"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Time to Sale
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div>{formatTimeGap(row.original.time_gap)}</div>,
        },
    ]

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center space-x-2">
                    <Input
                        placeholder="Filter by meal..."
                        value={(table.getColumn("meal")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("meal")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="noShadow" className="ml-auto">
                                Filters <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuCheckboxItem
                                checked={
                                    table.getColumn("role")?.getFilterValue() === undefined ||
                                    (table.getColumn("role")?.getFilterValue() as string[])?.includes("buyer")
                                }
                                onCheckedChange={(checked) => {
                                    const currentFilters = (table.getColumn("role")?.getFilterValue() as string[]) || []
                                    if (checked) {
                                        if (!currentFilters.includes("buyer")) {
                                            table.getColumn("role")?.setFilterValue([...currentFilters, "buyer"])
                                        }
                                    } else {
                                        table.getColumn("role")?.setFilterValue(currentFilters.filter(f => f !== "buyer"))
                                    }
                                }}
                            >
                                As Buyer
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={
                                    table.getColumn("role")?.getFilterValue() === undefined ||
                                    (table.getColumn("role")?.getFilterValue() as string[])?.includes("seller")
                                }
                                onCheckedChange={(checked) => {
                                    const currentFilters = (table.getColumn("role")?.getFilterValue() as string[]) || []
                                    if (checked) {
                                        if (!currentFilters.includes("seller")) {
                                            table.getColumn("role")?.setFilterValue([...currentFilters, "seller"])
                                        }
                                    } else {
                                        table.getColumn("role")?.setFilterValue(currentFilters.filter(f => f !== "seller"))
                                    }
                                }}
                            >
                                As Seller
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => router.push(`/mess/listings/transaction/${row.original.id}`)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of{" "}
                    {data.length} transaction(s)
                </div>
                <div className="space-x-2">
                    <Button
                        variant="noShadow"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="noShadow"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
