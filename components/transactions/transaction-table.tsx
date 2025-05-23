"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
    const [globalFilter, setGlobalFilter] = useState<string>("")
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    // Format date to show "28th May (Tue)"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return format(date, "do MMMM (EEE)")
    }

    // Format price to INR
    const formatPrice = (price: number | undefined) => {
        if (price === undefined) return "N/A"
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
                        variant="noShadow"
                        size="sm"
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
                        variant="noShadow"
                        size="sm"
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
                        variant="noShadow"
                        size="sm"
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
                        variant="noShadow"
                        size="sm"
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
                        variant="noShadow"
                        size="sm"
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
            header: ({ column }) => {
                return (
                    <Button
                        variant="noShadow"
                        size="sm"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Role
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const isUserBuyer = row.original.buyer_id === userRollNumber
                return (
                    <div>
                        <span className={"px-2 py-1 text-xs font-semibold"}>
                            {isUserBuyer ? "Buyer" : "Seller"}
                        </span>
                    </div>
                )
            },
            filterFn: (row, id, value) => {
                // If no filters are applied (empty array), show all rows
                if (!value || (Array.isArray(value) && value.length === 0)) {
                    return true
                }
                const isUserBuyer = row.original.buyer_id === userRollNumber
                const role = isUserBuyer ? "buyer" : "seller"
                return value.includes(role)
            },
        },
        {
            accessorKey: "other_party",
            header: ({ column }) => {
                return (
                    <Button
                        variant="noShadow"
                        size="sm"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Other Party
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
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
                        variant="noShadow"
                        size="sm"
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
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            globalFilter,
            columnVisibility,
        },
        globalFilterFn: (row, columnId, value) => {
            const searchValue = String(value).toLowerCase();

            // Search across all visible columns
            if (columnId === "date_of_transaction") {
                // Special handling for dates - use the formatted date that's displayed to user
                const dateString = row.getValue("date_of_transaction") as string;
                const date = new Date(dateString);
                const formattedDate = format(date, "do MMMM (EEE)").toLowerCase();

                // Also include raw date format for flexibility in searching
                const rawDate = dateString.toLowerCase();

                return formattedDate.includes(searchValue) || rawDate.includes(searchValue);
            } else if (columnId === "role") {
                // Special handling for the role column which isn't a direct value
                const isUserBuyer = row.original.buyer_id === userRollNumber;
                const roleText = isUserBuyer ? "buyer" : "seller";
                return roleText.includes(searchValue);
            } else if (columnId === "other_party") {
                // Special handling for other_party column which combines fields
                const isUserBuyer = row.original.buyer_id === userRollNumber;
                const partyName = isUserBuyer ? row.original.seller_name : row.original.buyer_name;
                return partyName?.toLowerCase().includes(searchValue) || false;
            } else {
                // Standard handling for all other columns
                const cellValue = String(row.getValue(columnId) || "").toLowerCase();
                return cellValue.includes(searchValue);
            }
        },
    })

    return (
        <div className="w-full font-base text-main-foreground space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center space-x-2">
                    <Input
                        placeholder="Search across all columns..."
                        value={globalFilter}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="max-w-sm"
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="noShadow" className="ml-auto">
                                Filters <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-main border-2 border-border">
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="noShadow">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-main border-2 border-border">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="border-2 border-border overflow-hidden">
                <Table>
                    <TableHeader className="font-heading">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                className="bg-secondary-background text-foreground"
                                key={headerGroup.id}
                            >
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead className="text-foreground" key={header.id}>
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
                                    className="bg-secondary-background text-foreground"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-4 py-2">
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
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground flex-1">
                    Showing {table.getRowModel().rows.length} of {" "}
                    {table.getFilteredRowModel().rows.length} transaction(s)
                </div>
                <div className="flex space-x-2">
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
