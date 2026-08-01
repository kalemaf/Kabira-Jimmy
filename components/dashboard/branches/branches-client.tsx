"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Building2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { useTableQuery } from "@/hooks/use-table-query"
import { branchSchema, type BranchInput } from "@/lib/schemas/branch"

type Branch = {
  id: string
  name: string
  code: string
  district: string
  address: string | null
  phone: string | null
  createdAt: string
}

type BranchesResponse = { data: Branch[]; total: number; page: number; totalPages: number }

export function BranchesClient() {
  const { page, search, setSearch, setPage } = useTableQuery()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["branches", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/branches", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load branches")
      return res.json() as Promise<BranchesResponse>
    },
    staleTime: 30_000,
  })

  const form = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: "", code: "", district: "", address: "", phone: "" },
  })

  const createBranch = useMutation({
    mutationFn: async (input: BranchInput) => {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to create branch");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Branch created");
      form.reset();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<Branch>[] = [
    { key: "name", header: "Name", render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "code", header: "Code", render: (b) => <span className="font-mono tabular-nums">{b.code}</span> },
    { key: "district", header: "District", render: (b) => b.district },
    { key: "phone", header: "Phone", render: (b) => b.phone ?? "—" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search branches..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add branch
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New branch</DialogTitle>
              <DialogDescription>Add a branch office to the SACCO network.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => createBranch.mutate(values))}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mbale Branch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch code</FormLabel>
                        <FormControl>
                          <Input placeholder="BR-MBL" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District</FormLabel>
                        <FormControl>
                          <Input placeholder="Mbale" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Plot 4, Republic Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+256454123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={createBranch.isPending}>
                    Create branch
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <PaginatedTable
        columns={columns}
        rows={data?.data ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Add your first branch to start assigning staff and members."
          />
        }
      />
    </div>
  )
}
