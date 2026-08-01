'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgetPasswordSchema, type ForgetPasswordInput } from '@/lib/auth-schemas'
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
import { AuthShell } from '@/components/auth/auth-shell'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function ForgetPassword() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ForgetPasswordInput>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: ForgetPasswordInput) {
    setIsLoading(true)
    await authClient.emailOtp.sendVerificationOtp({
        email: data.email,
        type: "forget-password",
    }, {
        onSuccess: () => {
             toast.success("If an account exists, a reset code has been sent.")
             sessionStorage.setItem("reset_email", data.email)
             router.push("/auth/reset-password")
        },
        onError: (ctx) => {
             form.setError('root', {
                message: ctx.error.message,
             })
             toast.error(ctx.error.message)
             setIsLoading(false)
        }
    })
    setIsLoading(false)
  }

  return (
    <AuthShell
      title="Reset password"
      description="Enter your email address and we'll send you a reset code"
      footer={
        <>
          Remember your password?
          <Button variant="link" className="ml-2 px-0" render={<Link href="/auth/sign-in" />} nativeButton={false}>
            Sign in
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@nextgensacco.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button className="w-full" type="submit" loading={isLoading}>
            Send reset code
          </Button>
        </form>
      </Form>
    </AuthShell>
  )
}
