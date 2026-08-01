"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, LogOut, KeyRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { passwordChangeSchema, type PasswordChangeInput } from "@/lib/auth-schemas"
import { memberAuthClient } from "@/lib/member-auth-client"

export function MemberSecurityClient() {
  const router = useRouter()
  const [isChanging, setIsChanging] = React.useState(false)
  const [isRevoking, setIsRevoking] = React.useState(false)
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)

  const form = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onSubmit(data: PasswordChangeInput) {
    setIsChanging(true)
    await memberAuthClient.changePassword(
      { currentPassword: data.currentPassword, newPassword: data.newPassword, revokeOtherSessions: true },
      {
        onSuccess: () => {
          toast.success("Password changed successfully.")
          form.reset()
          setIsChanging(false)
        },
        onError: (ctx) => {
          toast.error(ctx.error.message)
          setIsChanging(false)
        },
      }
    )
  }

  async function handleLogoutAllDevices() {
    setIsRevoking(true)
    await memberAuthClient.revokeSessions({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out of all devices")
          router.push("/member-portal/auth/sign-in")
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Failed to log out of all devices")
          setIsRevoking(false)
        },
      },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-(--text-primary)">
          <KeyRound className="size-4" />
          Change password
        </h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Current password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showCurrent ? "text" : "password"} className="pr-10" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showNew ? "text" : "password"} className="pr-10" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Confirm new password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showConfirm ? "text" : "password"} className="pr-10" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" loading={isChanging}>
              Update password
            </Button>
          </form>
        </Form>
      </div>

      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-(--text-primary)">
          <LogOut className="size-4" />
          Log out of all devices
        </h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Ends every active session on every device, including this one. You&apos;ll need to sign in again.
        </p>
        <Button variant="outline" className="mt-4" loading={isRevoking} onClick={handleLogoutAllDevices}>
          Log out everywhere
        </Button>
      </div>
    </div>
  )
}
