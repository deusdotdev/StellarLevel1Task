/**
 * Wallet connect / disconnect UI component.
 * All Freighter logic lives in useWallet; this file is presentation only.
 */
import type { UseWalletReturn } from '../hooks/useWallet'

/** Shorten a public key to GABC1234...WXYZ format */
function shortenPublicKey(key: string): string {
  if (key.length < 12) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

/** Receives wallet state from App so BalanceCard can share the same publicKey */
export function ConnectButton({
  publicKey,
  isConnecting,
  isRestoring,
  error,
  freighterDownloadUrl,
  connectWallet,
  disconnectWallet,
}: UseWalletReturn) {
  const isConnected = publicKey !== null
  const isBusy = isConnecting || isRestoring

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {!isConnected ? (
        <button
          type="button"
          onClick={() => void connectWallet()}
          disabled={isBusy}
          aria-busy={isBusy}
          className="ui-btn-primary flex items-center justify-center gap-2"
        >
          {isBusy && <span className="ui-spinner-inverse" aria-hidden="true" />}
          {isRestoring
            ? 'Restoring session...'
            : isConnecting
              ? 'Connecting...'
              : 'Connect Wallet'}
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-center gap-3">
          <span
            className="max-w-full truncate rounded-lg border border-border bg-surface px-4 py-2 font-mono text-sm text-electric"
            title={publicKey}
          >
            {shortenPublicKey(publicKey)}
          </span>
          <button
            type="button"
            onClick={disconnectWallet}
            className="ui-btn-secondary"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* After F5, Freighter may need a manual reconnect — hint when idle and disconnected */}
      {!isConnected && !isBusy && !error && (
        <p className="text-center text-xs text-muted">
          Connect your Freighter wallet to get started
        </p>
      )}

      {error && (
        <div role="alert" className="ui-alert-error">
          <p>{error}</p>
          {error.toLowerCase().includes('freighter') && (
            <a
              href={freighterDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-medium underline underline-offset-2 hover:text-electric"
            >
              Install Freighter
            </a>
          )}
        </div>
      )}
    </div>
  )
}
