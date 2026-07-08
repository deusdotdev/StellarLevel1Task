/**
 * Displays the connected wallet's native XLM balance on Testnet.
 * Renders nothing when no wallet is connected.
 */
import type { UseBalanceReturn } from '../hooks/useBalance'

interface BalanceCardProps {
  /** Connected public key from useWallet; null when disconnected */
  publicKey: string | null
  balance: UseBalanceReturn['balance']
  isLoading: UseBalanceReturn['isLoading']
  error: UseBalanceReturn['error']
  onRetry: UseBalanceReturn['fetchBalance']
}

/** Format a Horizon balance string for display (2 decimal places, readable) */
function formatXlm(balance: string): string {
  const value = Number.parseFloat(balance)
  if (Number.isNaN(value)) return balance
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function BalanceCard({
  publicKey,
  balance,
  isLoading,
  error,
  onRetry,
}: BalanceCardProps) {
  if (!publicKey) {
    return null
  }

  // Only show full loading UI on first fetch — keeps balance visible during refresh
  const isInitialLoad = isLoading && balance === null

  return (
    <div className="ui-card">
      {isInitialLoad && (
        <div className="flex flex-col items-center gap-3" aria-busy="true">
          <span className="ui-spinner" aria-hidden="true" />
          <p className="text-sm text-muted">Loading balance...</p>
        </div>
      )}

      {!isInitialLoad && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 text-center"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void onRetry()}
            className="ui-btn-secondary"
          >
            Retry
          </button>
        </div>
      )}

      {!isInitialLoad && !error && balance !== null && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-muted">Balance</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-electric sm:text-3xl">
              {formatXlm(balance)} XLM
            </span>
            <span className="rounded border border-purple/40 bg-purple/15 px-2 py-0.5 text-xs font-medium text-purple">
              Testnet
            </span>
          </div>
          {isLoading && (
            <p className="text-xs text-muted" aria-live="polite">
              Updating...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
