"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { memberProfileUpdateSchema, type MemberProfileUpdateInput } from "@/lib/schemas/member-profile"

type MemberProfile = {
  firstName: string
  lastName: string
  memberNumber: string
  nationalIdNumber: string | null
  nin: string | null
  phone: string
  dob: string | null
  gender: string | null
  dateJoined: string
  status: string
  branch: { name: string }
  email: string | null
  occupation: string | null
  employer: string | null
  district: string | null
  subCounty: string | null
  village: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  emergencyContact: string | null
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-(--border-subtle) py-2.5 text-sm last:border-b-0">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="text-right text-(--text-primary)">{value ?? "—"}</span>
    </div>
  )
}

export function MemberProfileClient() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ["member-profile"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/profile")
      if (!res.ok) throw new Error("Failed to load profile")
      return res.json() as Promise<MemberProfile>
    },
  })

  const form = useForm<MemberProfileUpdateInput>({
    resolver: zodResolver(memberProfileUpdateSchema),
    values: profile
      ? {
          email: profile.email ?? "",
          occupation: profile.occupation ?? "",
          employer: profile.employer ?? "",
          district: profile.district ?? "",
          subCounty: profile.subCounty ?? "",
          village: profile.village ?? "",
          nextOfKinName: profile.nextOfKinName ?? "",
          nextOfKinPhone: profile.nextOfKinPhone ?? "",
          emergencyContact: profile.emergencyContact ?? "",
        }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: async (values: MemberProfileUpdateInput) => {
      const res = await fetch("/api/member-portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to update profile")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Profile updated")
      queryClient.invalidateQueries({ queryKey: ["member-profile"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !profile) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <h2 className="mb-1 text-[15px] font-semibold text-(--text-primary)">Identity details</h2>
        <p className="mb-4 text-xs text-(--text-secondary)">
          Verified by your branch — contact them to correct any of this.
        </p>
        <ReadOnlyRow label="Full name" value={`${profile.firstName} ${profile.lastName}`} />
        <ReadOnlyRow label="Member number" value={profile.memberNumber} />
        <ReadOnlyRow label="National ID" value={profile.nationalIdNumber ?? profile.nin} />
        <ReadOnlyRow label="Phone" value={profile.phone} />
        <ReadOnlyRow label="Date of birth" value={profile.dob ? new Date(profile.dob).toLocaleDateString("en-UG") : null} />
        <ReadOnlyRow label="Gender" value={profile.gender} />
        <ReadOnlyRow label="Branch" value={profile.branch.name} />
        <ReadOnlyRow label="Date joined" value={new Date(profile.dateJoined).toLocaleDateString("en-UG")} />
      </div>

      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <h2 className="mb-1 text-[15px] font-semibold text-(--text-primary)">Contact & next of kin</h2>
        <p className="mb-4 text-xs text-(--text-secondary)">You can update these yourself.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupation</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subCounty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-county</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="village"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Village</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nextOfKinName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next of kin</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextOfKinPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next of kin phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="emergencyContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" loading={mutation.isPending}>
              Save changes
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
