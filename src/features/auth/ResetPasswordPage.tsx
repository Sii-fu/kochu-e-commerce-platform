import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/errors'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ErrorState } from '@/components/common/ErrorState'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  // The client (detectSessionInUrl: true) exchanges the email link's token
  // for a recovery session automatically and fires PASSWORD_RECOVERY -- but
  // that processing starts when the client module loads, before React mounts
  // this component, so the live event can fire before the listener below is
  // attached. `checked` distinguishes "still resolving" from "resolved to no
  // session", so a valid link that we simply raced doesn't flash "expired".
  const [ready, setReady] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecked(true)
      }
    })

    // Catches the case where PASSWORD_RECOVERY already fired before this
    // effect ran: the URL still carries `type=recovery` from the email link,
    // and by now a session exists to act on.
    const hasRecoveryHash = window.location.hash.includes('type=recovery')
    supabase.auth.getSession().then(({ data }) => {
      if (hasRecoveryHash && data.session) setReady(true)
      setChecked(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordInput) {
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    setSubmitting(false)

    if (error) {
      toast.error(authErrorMessage(error))
      return
    }

    toast.success('Password updated')
    navigate('/account', { replace: true })
  }

  if (!checked) return null

  if (!ready) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
        <ErrorState
          title="This link has expired"
          description="Password reset links only work once and expire after a while. Request a new one."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
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
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="tap-target w-full" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
