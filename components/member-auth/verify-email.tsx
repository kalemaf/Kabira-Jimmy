'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { verifyEmailSchema, type VerifyEmailInput } from '@/lib/auth-schemas'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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

export function MemberVerifyEmail() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const canResend = countdown <= 0
  const [email, setEmail] = useState('')

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("member_verify_email")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage on mount
    if (storedEmail) setEmail(storedEmail)
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const form = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  })

  async function onSubmit(data: VerifyEmailInput) {
    setIsLoading(true)
    await memberAuthClient.emailOtp.verifyEmail({
      email: email,
      otp: data.code,
    }, {
      onSuccess: () => {
        toast.success("Email verified successfully!")
        sessionStorage.removeItem("member_verify_email")
        router.push("/member-portal/auth/sign-in")
      },
      onError: (ctx) => {
        form.setError('root', { message: ctx.error.message })
        toast.error(ctx.error.message)
        setIsLoading(false)
      }
    })
  }

  async function handleResendCode() {
    if (!email) {
      toast.error("No email found to resend code.")
      return
    }
    setResendLoading(true)
    setCountdown(60)

    await memberAuthClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification"
    }, {
      onSuccess: () => {
        toast.success("Code resent! Check your email.")
        setResendLoading(false)
      },
      onError: (ctx) => {
        toast.error(ctx.error.message)
        setCountdown(0)
        setResendLoading(false)
      }
    })
  }

  return (
    <MemberAuthShell
      title="Verify your email"
      description={`We sent a verification code to ${email || "your email"}`}
      footer={
        <Button
          variant="link"
          className="ml-1 px-0"
          onClick={(e) => {
            e.preventDefault()
            handleResendCode()
          }}
          render={<button disabled={!canResend || resendLoading} />}
        >
          {resendLoading ? 'Resending...' : canResend ? "Didn't receive a code? Resend" : `Resend in ${countdown}s`}
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Verification code</FormLabel>
                <FormControl>
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup className="w-full justify-center">
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" type="submit" loading={isLoading}>
            Verify email
          </Button>
        </form>
      </Form>
    </MemberAuthShell>
  )
}
