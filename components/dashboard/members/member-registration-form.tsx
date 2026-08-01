"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PhoneInput } from "@/components/ui/phone-input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { SearchableSelect } from "@/components/searchable-select"
import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { useBranchOptions } from "@/hooks/use-branch-options"
import { memberSchema, type MemberInput } from "@/lib/schemas/member"
import { memberDocumentTypes, type MemberDocumentInput } from "@/lib/schemas/member-document"

// dob uses z.coerce.date() in the shared schema (it must accept a string
// once the form value round-trips through JSON to the API). The form itself
// only ever holds a real Date, so we type it explicitly and cast the
// resolver — the documented workaround for this exact RHF + zod.coerce gap.
type MemberFormValues = Omit<MemberInput, "dob"> & { dob?: Date }

const DOCUMENT_LABELS: Record<(typeof memberDocumentTypes)[number], string> = {
  NationalId: "National ID",
  Passport: "Passport",
  UtilityBill: "Utility bill",
  EmploymentLetter: "Employment letter",
  MembershipAgreement: "Membership agreement",
}

export function MemberRegistrationForm() {
  const router = useRouter()
  const { options: branchOptions } = useBranchOptions()
  const [documents, setDocuments] = React.useState<Record<string, string | undefined>>({})

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema) as unknown as Resolver<MemberFormValues>,
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      nin: "",
      occupation: "",
      employer: "",
      district: "",
      subCounty: "",
      village: "",
      nextOfKinName: "",
      nextOfKinPhone: "",
      emergencyContact: "",
      branchId: "",
      photoUrl: "",
      signatureUrl: "",
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: MemberFormValues) => {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to register member")
      }
      return res.json() as Promise<{ id: string }>
    },
    onSuccess: async (member) => {
      const pendingDocs = Object.entries(documents).filter(([, url]) => !!url) as [
        MemberDocumentInput["type"],
        string,
      ][]

      await Promise.all(
        pendingDocs.map(([type, fileUrl]) =>
          fetch(`/api/members/${member.id}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, fileUrl }),
          })
        )
      )

      toast.success("Member registered")
      router.push(`/dashboard/members/${member.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="max-w-3xl space-y-8"
      >
        <section className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-(--text-primary)">Personal information</h3>
            <p className="text-sm text-(--text-secondary)">Basic identity and contact details.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input placeholder="Grace" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input placeholder="Namutebi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="grace@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>NIN</FormLabel>
                  <FormControl>
                    <Input placeholder="CM12345678AB90" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel required>Date of birth</FormLabel>
                  <DatePicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Gender</FormLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={branchOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select branch"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-(--text-primary)">Employment &amp; location</h3>
            <p className="text-sm text-(--text-secondary)">Where the member lives and works.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Occupation</FormLabel>
                  <FormControl>
                    <Input placeholder="Market vendor" {...field} />
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
                    <Input placeholder="Self-employed" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="district"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>District</FormLabel>
                  <FormControl>
                    <Input placeholder="Kampala" {...field} />
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
                    <Input placeholder="Nakawa" {...field} />
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
                    <Input placeholder="Bugolobi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-(--text-primary)">Next of kin</h3>
            <p className="text-sm text-(--text-secondary)">Emergency and next-of-kin contacts.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nextOfKinName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Next of kin name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Ssebunya" {...field} />
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
                  <FormLabel required>Next of kin phone</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value} onChange={field.onChange} />
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
                  <PhoneInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div>
            <h3 className="text-[15px] font-semibold text-(--text-primary)">Documents</h3>
            <p className="text-sm text-(--text-secondary)">
              Photo, signature, and KYC documents. These can also be added later from the member profile.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <div>
                  <FileUploadField
                    label="Passport photo *"
                    value={field.value}
                    onChange={(url) => field.onChange(url ?? "")}
                    accept="image/*"
                  />
                  <FormMessage />
                </div>
              )}
            />
            <FormField
              control={form.control}
              name="signatureUrl"
              render={({ field }) => (
                <div>
                  <FileUploadField
                    label="Signature *"
                    value={field.value}
                    onChange={(url) => field.onChange(url ?? "")}
                    accept="image/*"
                  />
                  <FormMessage />
                </div>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {memberDocumentTypes.map((type) => (
              <FileUploadField
                key={type}
                label={DOCUMENT_LABELS[type]}
                value={documents[type]}
                onChange={(url) => setDocuments((prev) => ({ ...prev, [type]: url }))}
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/members")}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Register member
          </Button>
        </div>
      </form>
    </Form>
  )
}
