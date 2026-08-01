"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { PiggyBank, Plus, Search, Wallet, Landmark, LineChart } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { SearchableSelect } from "@/components/searchable-select"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { useTableQuery } from "@/hooks/use-table-query"
import { useMemberOptions } from "@/hooks/use-member-options"
import { formatUGX } from "@/lib/utils"
import { createSavingsAccountSchema, type CreateSavingsAccountInput } from "@/lib/schemas/savings"

type SavingsAccount = {
  id: string
  accountNumber: string
  type: "Daily" | "Fixed" | "Shares"
  balance: number
  member: { firstName: string; lastName: string; memberNumber: string }
}

type Response = {
  data: SavingsAccount[]
  total: number
  page: number
  totalPages: number
  totalBalance: number
  byType: Record<string, { count: number; balance: number }>
}

export function SavingsListClient({ canCreate }: { canCreate: boolean }) {
  const { page, search, setSearch, setPage } = useTableQuery()
  const [createOpen, setCreateOpen] = React.useState(false)
  const queryClient = useQueryClient()
  const { options: memberOptions } = useMemberOptions()

  const { data, isLoading } = useQuery({
    queryKey: ["savings-accounts", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/savings-accounts", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load savings accounts")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const form = useForm<CreateSavingsAccountInput>({
    resolver: zodResolver(createSavingsAccountSchema),
    defaultValues: { memberId: "", type: "Daily", openingDeposit: 0 },
  })

  const mutation = useMutation({
    mutationFn: async (values: CreateSavingsAccountInput) => {
      const res = await fetch("/api/savings-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to create account")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Savings account created")
      setCreateOpen(false)
      form.reset({ memberId: "", type: "Daily", openingDeposit: 0 })
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns: Column<SavingsAccount>[] = [
    { key: "accountNumber", header: "Account #", className: "font-mono tabular-nums", render: (a) => a.accountNumber },
    {
      key: "member",
      header: "Member",
      render: (a) => (
        <span className="font-medium">
          {a.member.firstName} {a.member.lastName}
        </span>
      ),
    },
    { key: "type", header: "Type", render: (a) => <StatusBadge status={a.type} tone="info" /> },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      className: "font-mono tabular-nums",
      render: (a) => formatUGX(a.balance),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total savings" value={formatUGX(data?.totalBalance ?? 0)} icon={Wallet} />
        <StatCard label="Total accounts" value={data?.total ?? 0} icon={PiggyBank} />
        <StatCard label="Daily savings" value={formatUGX(data?.byType.Daily?.balance ?? 0)} icon={Landmark} />
        <StatCard label="Fixed & shares" value={formatUGX((data?.byType.Fixed?.balance ?? 0) + (data?.byType.Shares?.balance ?? 0))} icon={LineChart} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search member..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New account
          </Button>
        ) : null}
      </div>

      <PaginatedTable
        columns={columns}
        rows={data?.data ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        rowHref={(a) => `/dashboard/savings/${a.id}`}
        emptyState={
          <EmptyState icon={PiggyBank} title="No savings accounts yet" description="Open the first account to get started." />
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex size-10 items-center justify-center rounded-full bg-(--accent-soft)">
              <PiggyBank className="size-5 text-(--accent-500)" strokeWidth={1.75} />
            </div>
            <DialogTitle>New savings account</DialogTitle>
            <p className="text-sm text-(--text-secondary)">A unique account number is generated automatically on creation.</p>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Member</FormLabel>
                    <FormControl>
                      <SearchableSelect options={memberOptions} value={field.value} onChange={field.onChange} placeholder="Select member" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Account type</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Daily">Daily — withdraw any time</SelectItem>
                        <SelectItem value="Fixed">Fixed — locked-term deposit</SelectItem>
                        <SelectItem value="Shares">Shares — membership capital</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingDeposit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening deposit</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                    </FormControl>
                    <p className="text-xs text-(--text-secondary)">Optional — leave as 0 to open with no initial balance.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={mutation.isPending}>
                  Create account
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
