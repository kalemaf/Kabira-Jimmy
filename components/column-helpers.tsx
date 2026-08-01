"use client";

import { ArrowUpDown, MoreHorizontal, Pencil, Trash } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Sortable column header button. */
export function SortableColumn({
  column,
  title,
}: {
  column: {
    toggleSorting: (desc: boolean) => void;
    getIsSorted: () => string | false;
  };
  title: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

/** Formatted date cell. */
export function DateColumn({
  row,
  accessorKey,
}: {
  row: { getValue: (key: string) => unknown };
  accessorKey: string;
}) {
  const value = row.getValue(accessorKey);
  if (!value) return <span className="text-muted-foreground">-</span>;
  const date = new Date(value as string);
  return (
    <span>
      {date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
    </span>
  );
}

/** Image thumbnail cell. */
export function ImageColumn({
  row,
  accessorKey,
}: {
  row: { getValue: (key: string) => unknown };
  accessorKey: string;
}) {
  const imageUrl = row.getValue(accessorKey) as string;
  return (
    <div className="shrink-0">
      <Image
        alt={accessorKey}
        className="aspect-square rounded-md object-cover"
        height={50}
        src={imageUrl ?? "/placeholder.png"}
        width={50}
      />
    </div>
  );
}

/** Status badge cell. */
export function StatusColumn({
  row,
  accessorKey,
}: {
  row: { getValue: (key: string) => unknown };
  accessorKey: string;
}) {
  const status = row.getValue(accessorKey);
  return <Badge variant="outline">{status ? "Active" : "Disabled"}</Badge>;
}

/** Action dropdown with edit and delete. */
export function ActionColumn({
  editHref,
  onDelete,
  deleteLabel = "Delete",
}: {
  editHref?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {editHref && (
          <DropdownMenuItem render={<a href={editHref} className="flex items-center gap-2" />}><Pencil className="h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDelete}
          >
            <Trash className="mr-2 h-4 w-4" />
            <span>{deleteLabel}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
