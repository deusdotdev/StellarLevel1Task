/**
 * XLM payment form — destination address + amount.
 * Uses useSendPayment for the actual transaction flow.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useSendPayment } from '../hooks/useSendPayment'
import type { PaymentResult } from '../hooks/useSendPayment'

interface PaymentFormProps {
  /** Connected sender public key; null when wallet is disconnected */
  sourcePublicKey: string | null
  /** Called after a successful on-chain submission (e.g. refresh balance) */
  onSuccess?: () => void
  /** Syncs the latest payment result to App for TxResult */
  onResultChange?: (result: PaymentResult | null) => void
}

export function PaymentForm({
  sourcePublicKey,
  onSuccess,
  onResultChange,
}: PaymentFormProps) {
  const { isSending, result, sendPayment } = useSendPayment(sourcePublicKey)
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    onResultChange?.(result)
  }, [result, onResultChange])

  const isDisabled = !sourcePublicKey || isSending

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSending) return

    const success = await sendPayment(destination, amount)
    if (success) {
      setDestination('')
      setAmount('')
      onSuccess?.()
    }
  }

  if (!sourcePublicKey) {
    return null
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="ui-card flex flex-col gap-4"
      aria-busy={isSending}
    >
      <h2 className="text-lg font-semibold text-text">Send XLM</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Recipient Address</span>
        <input
          type="text"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="G..."
          disabled={isDisabled}
          className="ui-input font-mono"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Amount (XLM)</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          disabled={isDisabled}
          className="ui-input"
        />
      </label>

      <button
        type="submit"
        disabled={isDisabled}
        className="ui-btn-primary flex items-center justify-center gap-2"
      >
        {isSending && <span className="ui-spinner-inverse" aria-hidden="true" />}
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
