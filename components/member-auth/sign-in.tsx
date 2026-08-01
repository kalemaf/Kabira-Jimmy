'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInInput } from '@/lib/auth-schemas'
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
import { memberAuthClient } from '@/lib/member-auth-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export function MemberSignIn() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: SignInInput) {
    setIsLoading(true)
    await memberAuthClient.signIn.email({
      email: data.email,
      password: data.password,
    }, {
      onSuccess: () => {
        toast.success("Signed in successfully!")
        router.push("/member-portal/dashboard")
      },
      onError: (ctx) => {
        form.setError('root', { message: ctx.error.message })
        toast.error(ctx.error.message)
        setIsLoading(false)
      }
    })
  }

  return (
    <MemberAuthShell
      title="Member sign in"
      description="Access your savings, loans, and statements"
      footer={
        <>
          Don&apos;t have a member account?
          <Button variant="link" className="ml-2 px-0" render={<Link href="/member-portal/auth/sign-up" />} nativeButton={false}>
            Create account
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
                <FormLabel required>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
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
                <div className="flex items-center justify-between">
                  <FormLabel required>Password</FormLabel>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    render={<Link href="/member-portal/auth/forgot-password" />}
                    nativeButton={false}
                  >
                    Forgot your password?
                  </Button>
                </div>
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

          <Button className="w-full" type="submit" loading={isLoading}>
            Sign in
          </Button>
        </form>
      </Form>
    </MemberAuthShell>
  )
}
