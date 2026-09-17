import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { joinEarlyAccess } from '@/lib/supabase/mutations'
import { earlyAccessSchema, type EarlyAccessInput } from '@/lib/validation/earlyAccess'
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

export function EarlyAccessPage() {
  const [joined, setJoined] = useState(false)

  const form = useForm<EarlyAccessInput>({
    resolver: zodResolver(earlyAccessSchema),
    defaultValues: { email: '' },
  })

  const mutation = useMutation({
    mutationFn: (input: EarlyAccessInput) => joinEarlyAccess(input.email),
    onSuccess: () => setJoined(true),
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Early access</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Join the list to hear about upcoming drops before anyone else, and get first pick when
        the window opens.
      </p>

      {joined ? (
        <p className="bg-secondary text-secondary-foreground mt-8 rounded-md p-4 text-sm">
          You're on the list. Watch your inbox.
        </p>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1 text-left">
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="tap-target" disabled={mutation.isPending}>
              {mutation.isPending ? 'Joining…' : 'Join the list'}
            </Button>
          </form>
        </Form>
      )}

      <p className="text-muted-foreground mt-6 text-sm">
        Already have an access key? Redeem it from the drop's own page.
      </p>
    </div>
  )
}
