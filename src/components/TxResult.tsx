/**
 * Shows the outcome of the last payment attempt (success or error).
 */
import type { PaymentResult } from '../hooks/useSendPayment'

interface TxResultProps {
  result: PaymentResult | null
}

const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/tx'

export function TxResult({ result }: TxResultProps) {
  if (!result) {
    return null
  }

  if (result.status === 'success' && result.hash) {
    return (
      <div role="status" className="ui-alert-success">
        <p className="font-semibold text-electric">Transaction successful</p>
        <p className="mt-2 break-all font-mono text-xs text-muted">
          {result.hash}
        </p>
        <a
          href={`${EXPLORER_BASE}/${result.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-electric underline underline-offset-2 hover:text-text"
        >
          View on Explorer
        </a>
      </div>
    )
  }

  return (
    <div role="alert" className="ui-alert-error max-w-md">
      <p>{result.message ?? 'Transaction failed'}</p>
    </div>
  )
}
