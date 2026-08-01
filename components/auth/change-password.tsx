'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { passwordChangeSchema, type PasswordChangeInput } from '@/lib/auth-schemas'
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
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export function ChangePassword() {
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: PasswordChangeInput) {
    setIsLoading(true)
    await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true,
    }, {
         onSuccess: () => {
            toast.success("Password changed successfully.")
            form.reset()
            setIsLoading(false)
         },
         onError: (ctx) => {
             form.setError('root', {
                message: ctx.error.message,
             })
             toast.error(ctx.error.message)
             setIsLoading(false)
         }
    })
  }

  return (
    <AuthShell
      title="Change password"
      description="Update your password to keep your account secure"
      footer={
        <>
          Go back to your profile
          <Button variant="link" className="ml-2 px-0" render={<Link href="/profile" />} nativeButton={false}>
            My profile
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff /> : <Eye />}
                      <span className="sr-only">
                        {showCurrentPassword ? 'Hide password' : 'Show password'}
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
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff /> : <Eye />}
                      <span className="sr-only">
                        {showNewPassword ? 'Hide password' : 'Show password'}
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
                <FormLabel>Confirm password</FormLabel>
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
            Update password
          </Button>
        </form>
      </Form>
    </AuthShell>
  )
}
