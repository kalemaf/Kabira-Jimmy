"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { UserCog, Plus, Search, Copy, Check, ShieldCheck } from "lucide-react"
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
import { SearchableSelect } from "@/components/searchable-select"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { PhoneInput } from "@/components/ui/phone-input"
import { PhotoCapture } from "@/components/ui/photo-capture"
import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { useTableQuery } from "@/hooks/use-table-query"
import { useBranchOptions } from "@/hooks/use-branch-options"
import { createStaffSchema, updateStaffSchema, staffRoles, type CreateStaffInput, type UpdateStaffInput } from "@/lib/schemas/staff"
import { ROLE_LABELS } from "@/components/dashboard/nav-config"

type Staff = {
  id: string
  name: string
  email: string
  phone: string | null
  role: (typeof staffRoles)[number]
  branchId: string | null
  emailVerified: boolean
  branch: { id: string; name: string; code: string } | null
  nationalIdNumber: string | null
  idDocumentUrl: string | null
  selfieUrl: string | null
  district: string | null
  subCounty: string | null
  village: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
}

type StaffResponse = { data: Staff[]; total: number; page: number; totalPages: number }

const ROLE_OPTIONS = staffRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))

export function StaffClient({ currentUserId }: { currentUserId: string }) {
  const { page, search, setSearch, setPage } = useTableQuery()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Staff | null>(null)
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(null)
  const queryClient = useQueryClient()
  const { options: branchOptions } = useBranchOptions()

  const { data, isLoading } = useQuery({
    queryKey: ["staff", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/staff", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load staff")
      return res.json() as Promise<StaffResponse>
    },
    staleTime: 30_000,
  })

  const createForm = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "LoanOfficer",
      branchId: "",
      nationalIdNumber: "",
      idDocumentUrl: "",
      selfieUrl: "",
      district: "",
      subCounty: "",
      village: "",
      nextOfKinName: "",
      nextOfKinPhone: "",
    },
  })

  const createStaff = useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to create staff account")
      }
      return res.json() as Promise<{ user: Staff; temporaryPassword: string }>
    },
    onSuccess: (result) => {
      toast.success("Staff account created")
      setCredentials({ email: result.user.email, password: result.temporaryPassword })
      createForm.reset()
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ["staff"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const editForm = useForm<UpdateStaffInput>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: { role: undefined, branchId: undefined },
  })

  React.useEffect(() => {
    if (editTarget) {
      editForm.reset({ role: editTarget.role, branchId: editTarget.branchId ?? undefined })
    }
  }, [editTarget, editForm])

  const updateStaff = useMutation({
    mutationFn: async (input: UpdateStaffInput) => {
      if (!editTarget) return
      const res = await fetch(`/api/staff/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to update staff")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Staff account updated")
      setEditTarget(null)
      queryClient.invalidateQueries({ queryKey: ["staff"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns: Column<Staff>[] = [
    {
      key: "name",
      header: "Name",
      render: (s) => (
        <div>
          <p className="font-medium">{s.name}</p>
          <p className="text-xs text-(--text-secondary)">{s.email}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => (
        <div>
          <p>{s.phone ?? "—"}</p>
          <p className="text-xs text-(--text-secondary)">
            {s.nationalIdNumber ? `ID ${s.nationalIdNumber}` : "No ID on file"}
          </p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (s) => <StatusBadge status={s.role} tone="info" label={ROLE_LABELS[s.role]} />,
    },
    { key: "branch", header: "Branch", render: (s) => s.branch?.name ?? "Unassigned" },
    {
      key: "kyc",
      header: "KYC",
      render: (s) =>
        s.idDocumentUrl && s.selfieUrl ? (
          <StatusBadge status="Verified" tone="success" />
        ) : (
          <StatusBadge status="Incomplete" tone="warning" />
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <Button variant="ghost" size="sm" onClick={() => setEditTarget(s)} disabled={s.id === currentUserId}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search staff..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Register staff
        </Button>
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
            icon={UserCog}
            title="No staff accounts yet"
            description="Register your first staff account to give them access to the dashboard."
          />
        }
      />

      {/* Create staff dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register staff</DialogTitle>
            <DialogDescription>
              Staff handle member cash and approve loans, so identity verification is required for
              every new account — national ID, a photo, and next of kin contact. A temporary
              password is generated for you to share with them.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((values) => createStaff.mutate(values))}>
              <div className="max-h-[62vh] space-y-5 overflow-y-auto py-1 pr-1">
                <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
                  <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Account details</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Nakato" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="jane@nextgensacco.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
                          <FormControl>
                            <PhoneInput value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={ROLE_OPTIONS}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select a role"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={branchOptions}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select a branch"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
                  <h3 className="mb-4 flex items-center gap-1.5 text-[15px] font-semibold text-(--text-primary)">
                    <ShieldCheck className="size-4" />
                    Identity verification
                  </h3>
                  <div className="space-y-5">
                    <FormField
                      control={createForm.control}
                      name="nationalIdNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>National ID number (NIN)</FormLabel>
                          <FormControl>
                            <Input placeholder="CM12345678ABCD" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FormField
                        control={createForm.control}
                        name="idDocumentUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <FileUploadField
                                label="National ID document"
                                description="Photo or scan of their national ID card."
                                value={field.value || undefined}
                                onChange={(url) => field.onChange(url ?? "")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="selfieUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Photo (taken at registration)</FormLabel>
                            <FormControl>
                              <PhotoCapture
                                value={field.value || undefined}
                                onChange={(url) => field.onChange(url ?? "")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
                  <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Residential address</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <FormField
                      control={createForm.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <FormControl>
                            <Input placeholder="Kampala" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="subCounty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sub-county</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="village"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Village</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
                  <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Next of kin</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      control={createForm.control}
                      name="nextOfKinName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full name</FormLabel>
                          <FormControl>
                            <Input placeholder="Next of kin's name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="nextOfKinPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
                          <FormControl>
                            <PhoneInput value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={createStaff.isPending}>
                  Create account
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit role/branch dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
            <DialogDescription>Change this staff member&apos;s role or branch.</DialogDescription>
          </DialogHeader>
          {editTarget ? (
            <div className="flex items-center gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-3">
              {editTarget.selfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editTarget.selfieUrl}
                  alt={editTarget.name}
                  className="size-12 shrink-0 rounded-full border border-(--border-subtle) object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--bg-card-hover) text-(--text-muted)">
                  <UserCog className="size-5" />
                </div>
              )}
              <div className="min-w-0 text-xs text-(--text-secondary)">
                <p className="truncate">{editTarget.phone ?? "No phone on file"}</p>
                <p className="truncate">
                  {editTarget.nationalIdNumber ? `ID ${editTarget.nationalIdNumber}` : "No national ID on file"}
                </p>
                <p className="truncate">
                  Next of kin: {editTarget.nextOfKinName ?? "—"}
                  {editTarget.nextOfKinPhone ? ` · ${editTarget.nextOfKinPhone}` : ""}
                </p>
              </div>
            </div>
          ) : null}
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((values) => updateStaff.mutate(values))}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={ROLE_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a role"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={branchOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a branch"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={updateStaff.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Temporary password reveal */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>
              Share these credentials with {credentials?.email} — this password is shown only once.
            </DialogDescription>
          </DialogHeader>
          {credentials ? <TemporaryPasswordReveal credentials={credentials} /> : null}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemporaryPasswordReveal({ credentials }: { credentials: { email: string; password: string } }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="space-y-3 rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4">
      <div>
        <p className="text-xs text-(--text-secondary)">Email</p>
        <p className="font-mono text-sm text-(--text-primary)">{credentials.email}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-(--text-secondary)">Temporary password</p>
          <p className="font-mono text-sm tabular-nums text-(--text-primary)">{credentials.password}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(credentials.password)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}
