'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signUpSchema, type SignUpInput } from '@/lib/auth-schemas'
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

export function MemberSignUp() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(data: SignUpInput) {
    setIsLoading(true)
    await memberAuthClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      callbackURL: "/member-portal/dashboard",
    }, {
      onSuccess: async () => {
        await memberAuthClient.emailOtp.sendVerificationOtp({
          email: data.email,
          type: "email-verification"
        }, {
          onSuccess: () => {
            toast.success("Account created! Please check your email.")
            sessionStorage.setItem("member_verify_email", data.email)
            router.push("/member-portal/auth/verify-email")
          },
          onError: () => {
            toast.error("Account created but failed to send verification email. Please try resending.")
            sessionStorage.setItem("member_verify_email", data.email)
            router.push("/member-portal/auth/verify-email")
            setIsLoading(false)
          }
        })
      },
      onError: (ctx) => {
        form.setError('root', { message: ctx.error.message || "Signup failed" })
        toast.error(ctx.error.message)
        setIsLoading(false)
      }
    })
  }

  return (
    <MemberAuthShell
      title="Create member account"
      description="Set up self-service access to your Nexcgen accounts"
      footer={
        <>
          Already have an account?
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="As registered with your branch" {...field} />
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
                <FormLabel required>Password</FormLabel>
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
            Continue
          </Button>
        </form>
      </Form>
    </MemberAuthShell>
  )
}
