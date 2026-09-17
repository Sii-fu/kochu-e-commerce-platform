import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/hooks/useSession'
import { useProfile } from '@/hooks/useProfile'
import { updateProfile } from '@/lib/supabase/mutations'
import { profileSchema, type ProfileInput } from '@/lib/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

export function ProfileForm() {
  const { session } = useSession()
  const { profile, isLoading } = useProfile()
  const queryClient = useQueryClient()

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '' },
  })

  // Profile loads async after the form mounts; reset once real data arrives
  // so the fields aren't stuck on the empty defaults.
  useEffect(() => {
    if (profile) {
      form.reset({ fullName: profile.full_name ?? '', phone: profile.phone ?? '' })
    }
  }, [profile, form])

  const mutation = useMutation({
    mutationFn: (input: ProfileInput) => updateProfile(session!.user.id, input),
    onSuccess: () => {
      toast.success('Profile updated')
      queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] })
    },
    onError: () => toast.error('Could not update your profile. Try again.'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="max-w-md space-y-5"
      >
        <FormItem>
          <FormLabel>Email</FormLabel>
          <Input value={session?.user.email ?? ''} disabled />
        </FormItem>

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
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
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Form>
  )
}
