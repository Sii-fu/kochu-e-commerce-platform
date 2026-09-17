import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getStoreSettings } from '@/lib/supabase/queries'
import { updateStoreSettings } from '@/lib/supabase/admin/mutations'
import { storeSettingsSchema, type StoreSettingsInput } from '@/lib/validation/admin'
import { fromMinor } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
  })

  const form = useForm<StoreSettingsInput>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: {
      freeShippingThresholdTaka: 0,
      flatShippingTaka: 0,
      bkashNumber: '',
      nagadNumber: '',
      supportEmail: '',
      supportPhone: '',
      announcement: '',
    },
  })

  useEffect(() => {
    if (!settings) return
    form.reset({
      freeShippingThresholdTaka: fromMinor(settings.free_shipping_threshold_minor),
      flatShippingTaka: fromMinor(settings.flat_shipping_minor),
      bkashNumber: settings.bkash_number ?? '',
      nagadNumber: settings.nagad_number ?? '',
      supportEmail: settings.support_email ?? '',
      supportPhone: settings.support_phone ?? '',
      announcement: settings.announcement ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const save = useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: ['store-settings'] })
    },
    onError: () => toast.error('Could not save settings.'),
  })

  if (isLoading) {
    return (
      <div className="max-w-xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-xl font-semibold">Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="freeShippingThresholdTaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Free shipping over (৳)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flatShippingTaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flat shipping fee (৳)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="bkashNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>bKash merchant number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nagadNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nagad merchant number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supportEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supportPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support phone (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="announcement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site announcement (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
