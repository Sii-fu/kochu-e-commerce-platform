import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { submitMfsTransaction } from '@/lib/supabase/rpc'
import { checkoutErrorMessage } from '@/lib/errors'
import { mfsSubmissionSchema, type MfsSubmissionInput } from '@/lib/validation/checkout'
import { formatBDT } from '@/lib/money'
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

type MfsPaymentPanelProps = {
  orderId: string
  token: string
  provider: 'BKASH' | 'NAGAD'
  amountMinor: number
  merchantNumber: string | null
  onSubmitted: () => void
}

/**
 * Manual MFS is a trust workflow, not a payment gateway (CLAUDE.md's known
 * risks) -- there is no bKash/Nagad API integration here. The customer sends
 * money by hand in their wallet app, then reports the TrxID it gave them.
 * `unique (provider, trx_id)` blocks reusing a receipt across orders; a
 * fabricated TrxID is only ever caught by an admin checking the merchant app
 * in the verification queue.
 */
export function MfsPaymentPanel({
  orderId,
  token,
  provider,
  amountMinor,
  merchantNumber,
  onSubmitted,
}: MfsPaymentPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const providerLabel = provider === 'BKASH' ? 'bKash' : 'Nagad'

  useEffect(() => {
    if (!merchantNumber) return
    let cancelled = false
    QRCode.toDataURL(merchantNumber, { margin: 1, width: 176 }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [merchantNumber])

  const form = useForm<MfsSubmissionInput>({
    resolver: zodResolver(mfsSubmissionSchema),
    defaultValues: { senderMsisdn: '', trxId: '' },
  })

  const submit = useMutation({
    mutationFn: (values: MfsSubmissionInput) =>
      submitMfsTransaction({
        orderId,
        token,
        provider,
        trxId: values.trxId,
        senderMsisdn: values.senderMsisdn,
      }),
    onSuccess: () => {
      toast.success('Payment submitted for verification')
      onSubmitted()
    },
    onError: (error) => toast.error(checkoutErrorMessage(error)),
  })

  return (
    <div className="rounded-md border p-4">
      <h2 className="font-display text-base font-medium">Pay with {providerLabel}</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Send <span className="text-foreground font-medium">{formatBDT(amountMinor)}</span> to the{' '}
        {providerLabel} number below using "Send Money", then enter the transaction ID it gives
        you.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`QR code for the ${providerLabel} merchant number`}
            className="size-24 shrink-0 rounded-md border"
          />
        )}
        <div>
          <p className="text-muted-foreground text-xs">{providerLabel} number</p>
          <p className="text-lg font-semibold tabular-nums">
            {merchantNumber ?? 'Not set up yet -- contact support'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => submit.mutate(values))}
          className="mt-6 space-y-4"
        >
          <FormField
            control={form.control}
            name="senderMsisdn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>The number you sent from</FormLabel>
                <FormControl>
                  <Input type="tel" autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction ID</FormLabel>
                <FormControl>
                  <Input {...field} className="uppercase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="tap-target w-full" disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="size-4 animate-spin" />}
            {submit.isPending ? 'Submitting…' : 'Submit payment'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
