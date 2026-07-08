/**
 * Stellar network constants (TESTNET).
 *
 * Single source of truth for Horizon / Soroban calls later.
 * Mainnet (Networks.PUBLIC) is NOT used.
 */
import { Horizon, Networks } from '@stellar/stellar-sdk'

/** Testnet network passphrase — required when signing transactions */
export const NETWORK_PASSPHRASE = Networks.TESTNET

/** Horizon REST API (accounts, balances, transaction history, etc.) */
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'

/** Soroban RPC (for smart contract calls) */
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'

/** Freighter download page — send users here when the extension is missing */
export const FREIGHTER_DOWNLOAD_URL = 'https://www.freighter.app/'

/**
 * Shared Horizon server for Testnet.
 * Use this for loadAccount, submitTransaction, etc.
 */
export const horizonServer = new Horizon.Server(HORIZON_URL)

/** Horizon request timeout — avoids indefinite loading on network issues */
export const HORIZON_TIMEOUT_MS = 15_000

/**
 * Normalize Freighter API errors into user-facing strings.
 * Prevents raw SDK objects from reaching the UI.
 */
export function formatFreighterError(error: unknown, fallback: string): string {
  if (!error) return fallback

  if (typeof error === 'string') {
    return mapFreighterMessage(error, fallback)
  }

  if (error instanceof Error) {
    return mapFreighterMessage(error.message, fallback)
  }

  if (
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return mapFreighterMessage((error as { message: string }).message, fallback)
  }

  return fallback
}

/** Map known Freighter states (locked, denied) to friendly copy */
function mapFreighterMessage(message: string, fallback: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('not installed') || lower.includes('not found')) {
    return 'Freighter wallet not found, please install it'
  }

  if (lower.includes('locked') || lower.includes('unlock')) {
    return 'Freighter is locked, please unlock your wallet and try again'
  }

  if (lower.includes('denied') || lower.includes('rejected') || lower.includes('cancel')) {
    return 'Freighter request was denied'
  }

  if (lower.includes('status code') || lower.includes('network')) {
    return fallback
  }

  return message
}

/** Race a promise against a timeout to surface network stalls clearly */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, ms)

    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((err: unknown) => {
        window.clearTimeout(timer)
        reject(err)
      })
  })
}

/** Detect fetch/network failures that are not Horizon business errors */
export function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const message = err.message.toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  )
}
