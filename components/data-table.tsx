"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Settings2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// ─── SearchBar ──────────────────────────────────────────────
function DataTableSearch({
  data,
  onSearch,
  placeholder = "Search...",
}: {
  data: unknown[];
  onSearch: (filtered: unknown[]) => void;
  placeholder?: string;
}) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    const filtered = (data as Record<string, unknown>[]).filter((item) =>
      Object.values(item).some(
        (value) =>
          value && String(value).toLowerCase().includes(term.toLowerCase())
      )
    );
    onSearch(filtered);
  };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleSearch}
        className="h-10 w-full rounded-sm border border-(--border-subtle) bg-(--bg-input) py-1 pr-3.5 pl-9 text-sm text-(--text-primary) transition-colors outline-none placeholder:text-(--text-muted) focus-visible:border-(--accent-500) focus-visible:shadow-[var(--shadow-focus)]"
      />
    </div>
  );
}

// ─── ViewOptions ────────────────────────────────────────────
function DataTableViewOptions<TData>({
  table,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="ml-auto hidden h-9 lg:flex" />}><Settings2 className="mr-2 h-4 w-4" />View
                  </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide()
          )
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Pagination ─────────────────────────────────────────────
function DataTablePagination<TData>({
  table,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => value && table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <svg className="h-4 w-4" viewBox="0 0 15 15" fill="none">
              <path
                d="M8.842 3.135a.5.5 0 01.023.707L5.435 7.5l3.43 3.658a.5.5 0 01-.73.684l-3.75-4a.5.5 0 010-.684l3.75-4a.5.5 0 01.707-.023z"
                fill="currentColor"
              />
            </svg>
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <svg className="h-4 w-4" viewBox="0 0 15 15" fill="none">
              <path
                d="M6.158 3.135a.5.5 0 01.707.023l3.75 4a.5.5 0 010 .684l-3.75 4a.5.5 0 01-.73-.684L9.565 7.5l-3.43-3.658a.5.5 0 01.023-.707z"
                fill="currentColor"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main DataTable ─────────────────────────────────────────
export interface DataTableProps<TData, TValue> {
  /** Column definitions for the table. */
  columns: ColumnDef<TData, TValue>[];
  /** The data array to display. */
  data: TData[];
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Whether to show the search bar. @default true */
  searchable?: boolean;
  /** Whether to show column visibility toggle. @default true */
  showViewOptions?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchable = true,
  showViewOptions = true,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [searchResults, setSearchResults] = React.useState(data);

  React.useEffect(() => {
    setSearchResults(data);
  }, [data]);

  const table = useReactTable({
    data: searchResults as TData[],
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {searchable && (
          <DataTableSearch
            data={data as unknown[]}
            onSearch={(filtered) => setSearchResults(filtered as TData[])}
            placeholder={searchPlaceholder}
          />
        )}
        {showViewOptions && <DataTableViewOptions table={table} />}
      </div>

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-(--text-secondary)"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}

// ─── Column Helpers ─────────────────────────────────────────
export { DataTablePagination, DataTableSearch, DataTableViewOptions };
