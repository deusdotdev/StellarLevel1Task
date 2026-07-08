/**
 * Fetches the native XLM balance for a connected Stellar account.
 *
 * No polling — refetch only when publicKey changes or the caller
 * invokes fetchBalance() (e.g. a "Retry" button).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { NotFoundError } from '@stellar/stellar-sdk'
import {
  HORIZON_TIMEOUT_MS,
  horizonServer,
  isNetworkFailure,
  withTimeout,
} from '../lib/stellar'

/** Shown when Horizon returns 404 (account never funded on Testnet) */
const ACCOUNT_NOT_FUNDED_MESSAGE =
  'This account is not active on testnet yet, fund it with Friendbot'

const NETWORK_ERROR_MESSAGE =
  'Network error while fetching balance, please try again'

const TIMEOUT_ERROR_MESSAGE =
  'Balance request timed out, please try again'

export interface UseBalanceReturn {
  /** Native XLM balance string from Horizon, or null */
  balance: string | null
  /** Whether a fetch is in progress */
  isLoading: boolean
  /** User-facing error message */
  error: string | null
  /** Manually re-fetch the balance */
  fetchBalance: () => Promise<void>
}

/**
 * @param publicKey - Connected Freighter public key from useWallet (or null)
 */
export function useBalance(publicKey: string | null): UseBalanceReturn {
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchIdRef = useRef(0)
  const lastPublicKeyRef = useRef<string | null>(null)

  const fetchBalance = useCallback(async () => {
    // No wallet → clear balance UI state and skip the network call
    if (!publicKey) {
      setBalance(null)
      setError(null)
      setIsLoading(false)
      lastPublicKeyRef.current = null
      return
    }

    const fetchId = ++fetchIdRef.current
    const isNewAccount = lastPublicKeyRef.current !== publicKey

    // Clear stale balance only when the connected account changes (prevents flicker on refresh)
    if (isNewAccount) {
      setBalance(null)
      lastPublicKeyRef.current = publicKey
    }

    setIsLoading(true)
    setError(null)

    try {
      const account = await withTimeout(
        horizonServer.loadAccount(publicKey),
        HORIZON_TIMEOUT_MS,
        TIMEOUT_ERROR_MESSAGE,
      )

      // Ignore stale responses if a newer fetch started
      if (fetchId !== fetchIdRef.current) return

      const native = account.balances.find(
        (entry) => entry.asset_type === 'native',
      )

      if (!native) {
        setBalance(null)
        setError('Native XLM balance not found')
        return
      }

      setBalance(native.balance)
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return

      setBalance(null)

      if (err instanceof NotFoundError) {
        setError(ACCOUNT_NOT_FUNDED_MESSAGE)
        return
      }

      if (err instanceof Error && err.message === TIMEOUT_ERROR_MESSAGE) {
        setError(TIMEOUT_ERROR_MESSAGE)
        console.error('fetchBalance timed out:', err)
        return
      }

      if (isNetworkFailure(err)) {
        setError(NETWORK_ERROR_MESSAGE)
        console.error('fetchBalance network error:', err)
        return
      }

      setError('Could not fetch balance, please try again')
      console.error('fetchBalance failed:', err)
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicKey])

  // Re-fetch whenever the connected public key changes
  useEffect(() => {
    void fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    isLoading,
    error,
    fetchBalance,
  }
}
