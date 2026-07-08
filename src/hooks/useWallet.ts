/**
 * Freighter wallet connection hook.
 *
 * Handles connect / disconnect only.
 * No balance or transaction logic here — those come in later steps.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  getAddress,
  isAllowed,
  isConnected,
  setAllowed,
} from '@stellar/freighter-api'
import {
  formatFreighterError,
  FREIGHTER_DOWNLOAD_URL,
} from '../lib/stellar'

/** Clear error shown when the Freighter extension is missing */
const FREIGHTER_NOT_FOUND_MESSAGE =
  'Freighter wallet not found, please install it'

export interface UseWalletReturn {
  /** Connected account public key (G...), or null */
  publicKey: string | null
  /** Whether a connect request is in progress */
  isConnecting: boolean
  /** Whether a prior Freighter session is being restored after page load */
  isRestoring: boolean
  /** Error message to show the user */
  error: string | null
  /** Freighter download link (useful in the error UI) */
  freighterDownloadUrl: string
  /** Ask Freighter for permission and fetch the address */
  connectWallet: () => Promise<void>
  /** Clear app-side connection state */
  disconnectWallet: () => void
}

export function useWallet(): UseWalletReturn {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // 1) Is the extension installed?
      const connectedResult = await isConnected()

      if (connectedResult.error || !connectedResult.isConnected) {
        setError(FREIGHTER_NOT_FOUND_MESSAGE)
        setPublicKey(null)
        return
      }

      // 2) Ask the user to add this app to Freighter's Allow List
      const allowedResult = await setAllowed()

      if (allowedResult.error || !allowedResult.isAllowed) {
        setError(
          formatFreighterError(
            allowedResult.error,
            'Freighter permission denied or could not be obtained',
          ),
        )
        setPublicKey(null)
        return
      }

      // 3) Fetch the public key (fails gracefully when Freighter is locked)
      const addressResult = await getAddress()

      if (addressResult.error || !addressResult.address) {
        setError(
          formatFreighterError(
            addressResult.error,
            'Could not retrieve wallet address — unlock Freighter and try again',
          ),
        )
        setPublicKey(null)
        return
      }

      setPublicKey(addressResult.address)
    } catch (err) {
      // Catch-all so a missing/locked extension never crashes the app
      console.error('connectWallet failed:', err)
      setError(formatFreighterError(err, FREIGHTER_NOT_FOUND_MESSAGE))
      setPublicKey(null)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  /**
   * Freighter has no official "disconnect" API.
   * We only reset our React state so the app shows as "not connected".
   */
  const disconnectWallet = useCallback(() => {
    setPublicKey(null)
    setError(null)
  }, [])

  /**
   * On page refresh, silently restore the session if Freighter already
   * authorized this app. Otherwise the user clicks "Connect Wallet" again.
   */
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const connectedResult = await isConnected()
        if (connectedResult.error || !connectedResult.isConnected) return

        const allowedResult = await isAllowed()
        if (allowedResult.error || !allowedResult.isAllowed) return

        const addressResult = await getAddress()
        if (cancelled) return

        if (addressResult.error || !addressResult.address) {
          // Freighter may be locked after refresh — user must reconnect manually
          console.error('restoreSession: could not read address', addressResult.error)
          return
        }

        setPublicKey(addressResult.address)
      } catch (err) {
        console.error('restoreSession failed:', err)
      } finally {
        if (!cancelled) setIsRestoring(false)
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    publicKey,
    isConnecting,
    isRestoring,
    error,
    freighterDownloadUrl: FREIGHTER_DOWNLOAD_URL,
    connectWallet,
    disconnectWallet,
  }
}
