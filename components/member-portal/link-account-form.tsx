"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { linkMemberSchema, type LinkMemberInput } from "@/lib/schemas/member-link"

export function LinkAccountForm() {
  const router = useRouter()

  const form = useForm<LinkMemberInput>({
    resolver: zodResolver(linkMemberSchema),
    defaultValues: { memberNumber: "", phone: "" },
  })

  const mutation = useMutation({
    mutationFn: async (values: LinkMemberInput) => {
      const res = await fetch("/api/member-portal/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to link account")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Account linked — welcome!")
      router.push("/member-portal/dashboard/savings")
      router.refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5">
        <FormField
          control={form.control}
          name="memberNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Member number</FormLabel>
              <FormControl>
                <Input placeholder="NGS-000057" {...field} />
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
              <FormLabel required>Phone number on file</FormLabel>
              <FormControl>
                <PhoneInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Link account
        </Button>
      </form>
    </Form>
  )
}
