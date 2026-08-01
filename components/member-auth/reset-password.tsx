'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MemberAuthShell } from '@/components/member-portal/member-auth-shell'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { memberAuthClient } from '@/lib/member-auth-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

const resetPasswordOtpSchema = z.object({
  otp: z.string().min(6, "Please enter the 6-digit code"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordOtpInput = z.infer<typeof resetPasswordOtpSchema>

export function MemberResetPassword() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("member_reset_email")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage on mount
    if (storedEmail) setEmail(storedEmail)
  }, [])

  const form = useForm<ResetPasswordOtpInput>({
    resolver: zodResolver(resetPasswordOtpSchema),
    defaultValues: { otp: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(data: ResetPasswordOtpInput) {
    if (!email) {
      toast.error("Email not found. Please go back and request a new reset code.")
      return
    }

    setIsLoading(true)
    await memberAuthClient.emailOtp.resetPassword({
      email,
      otp: data.otp,
      password: data.password,
    }, {
      onSuccess: () => {
        toast.success("Password reset successfully! Please log in.")
        sessionStorage.removeItem("member_reset_email")
        router.push("/member-portal/auth/sign-in")
      },
      onError: (ctx) => {
        form.setError('root', { message: ctx.error.message })
        toast.error(ctx.error.message)
        setIsLoading(false)
      }
    })
    setIsLoading(false)
  }

  async function handleResendOtp() {
    if (!email) {
      toast.error("Email not found. Please go back and request a new reset code.")
      return
    }

    await memberAuthClient.emailOtp.sendVerificationOtp({
      email,
      type: "forget-password",
    }, {
      onSuccess: () => {
        toast.success("A new reset code has been sent to your email.")
      },
      onError: (ctx) => {
        toast.error(ctx.error.message)
      },
    })
  }

  if (!email) {
    return (
      <MemberAuthShell title="Session expired" description="Please request a new password reset code.">
        <Button className="w-full" render={<Link href="/member-portal/auth/forgot-password" />} nativeButton={false}>
          Request reset code
        </Button>
      </MemberAuthShell>
    )
  }

  return (
    <MemberAuthShell
      title="Reset your password"
      description={`Enter the 6-digit code sent to ${email} and your new password.`}
      footer={
        <>
          Remember your password?
          <Button variant="link" className="ml-2 px-0" render={<Link href="/member-portal/auth/sign-in" />} nativeButton={false}>
            Sign in
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="otp"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Verification code</FormLabel>
                <FormControl>
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup className="flex w-full justify-between">
                      <InputOTPSlot index={0} className="flex-1" />
                      <InputOTPSlot index={1} className="flex-1" />
                      <InputOTPSlot index={2} className="flex-1" />
                      <InputOTPSlot index={3} className="flex-1" />
                      <InputOTPSlot index={4} className="flex-1" />
                      <InputOTPSlot index={5} className="flex-1" />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                      <span className="sr-only">
                        {showPassword ? 'Hide password' : 'Show password'}
                      </span>
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
                <FormLabel required>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                      <span className="sr-only">
                        {showConfirmPassword ? 'Hide password' : 'Show password'}
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" type="submit" loading={isLoading}>
            Reset password
          </Button>

          <Button type="button" variant="link" onClick={handleResendOtp} className="w-full text-sm">
            Didn&apos;t receive the code? Resend
          </Button>
        </form>
      </Form>
    </MemberAuthShell>
  )
}
