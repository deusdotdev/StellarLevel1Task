/**
 * Sends native XLM payments on Stellar Testnet via Freighter + Horizon.
 */
import { useCallback, useRef, useState } from 'react'
import {
  Asset,
  BASE_FEE,
  NetworkError,
  NotFoundError,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { signTransaction } from '@stellar/freighter-api'
import {
  formatFreighterError,
  HORIZON_TIMEOUT_MS,
  horizonServer,
  isNetworkFailure,
  NETWORK_PASSPHRASE,
  withTimeout,
} from '../lib/stellar'

export interface PaymentResult {
  status: 'success' | 'error'
  hash?: string
  message?: string
}

export interface UseSendPaymentReturn {
  isSending: boolean
  result: PaymentResult | null
  /** Returns true when the payment was submitted successfully */
  sendPayment: (destination: string, amount: string) => Promise<boolean>
  /** Clear the last result (e.g. before a new attempt) */
  clearResult: () => void
}

/** Stellar public keys start with G and are exactly 56 characters */
function validateDestination(address: string): string | null {
  const trimmed = address.trim()
  if (!trimmed.startsWith('G') || trimmed.length !== 56) {
    return 'Invalid Stellar address (must start with G and be 56 characters)'
  }
  return null
}

/** XLM amounts must be positive, up to 7 decimal places */
function validateAmount(amount: string): string | null {
  const trimmed = amount.trim()
  const value = Number(trimmed)

  if (!trimmed || Number.isNaN(value) || value <= 0) {
    return 'Amount must be a positive number'
  }

  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    return 'Amount can have at most 7 decimal places'
  }

  return null
}

/** Turn Horizon extras.result_codes into a user-friendly message */
function mapHorizonResultCodes(
  transactionCode?: string,
  operationCode?: string,
): string {
  if (transactionCode === 'tx_insufficient_balance' || operationCode === 'op_underfunded') {
    return 'Insufficient balance'
  }
  if (operationCode === 'op_no_destination') {
    return 'Destination account is not active on testnet yet. Fund it with Friendbot first'
  }
  if (transactionCode === 'tx_bad_seq') {
    return 'Account sequence number is out of date, please try again'
  }
  if (transactionCode === 'tx_bad_auth' || transactionCode === 'tx_bad_auth_extra') {
    return 'Signature authorization failed'
  }
  if (transactionCode === 'tx_too_late') {
    return 'Transaction timed out, please try again'
  }
  if (operationCode === 'op_over_source_max') {
    return 'Sending limit exceeded'
  }

  const parts = [transactionCode, operationCode].filter(Boolean)
  if (parts.length > 0) {
    return `Transaction failed (${parts.join(', ')})`
  }

  return 'Transaction failed'
}

interface HorizonErrorBody {
  detail?: string
  extras?: {
    result_codes?: {
      transaction?: string
      operations?: string[]
    }
  }
}

const DESTINATION_NOT_FUNDED_MESSAGE =
  'Destination account is not active on testnet yet. Fund it with Friendbot first'

const NETWORK_ERROR_MESSAGE =
  'Network error while sending payment, please try again'

const TIMEOUT_ERROR_MESSAGE =
  'Request timed out, please try again'

/**
 * Horizon errors may arrive as NetworkError OR as a plain Error
 * with an axios-style `response.data` payload (fetch-client in stellar-sdk v16).
 */
function extractHorizonErrorData(err: unknown): HorizonErrorBody | undefined {
  if (!err || typeof err !== 'object') return undefined

  if (err instanceof NetworkError) {
    return err.response?.data as HorizonErrorBody | undefined
  }

  if ('response' in err) {
    const response = (err as { response?: { data?: HorizonErrorBody } }).response
    return response?.data
  }

  return undefined
}

/** Extract a readable message from Horizon / Freighter / unknown errors */
function parseSubmitError(err: unknown): string {
  if (err instanceof Error && err.message === TIMEOUT_ERROR_MESSAGE) {
    return TIMEOUT_ERROR_MESSAGE
  }

  if (isNetworkFailure(err)) {
    return NETWORK_ERROR_MESSAGE
  }

  const data = extractHorizonErrorData(err)
  const codes = data?.extras?.result_codes

  if (codes) {
    return mapHorizonResultCodes(codes.transaction, codes.operations?.[0])
  }

  // Never surface raw Horizon detail strings — they are often technical
  if (err instanceof Error) {
    if (/status code \d+/i.test(err.message)) {
      return 'Could not submit transaction, please try again'
    }
    return formatFreighterError(err, 'Could not submit transaction, please try again')
  }

  return 'Could not submit transaction, please try again'
}

/**
 * @param sourcePublicKey - Connected Freighter public key (sender), or null
 */
export function useSendPayment(
  sourcePublicKey: string | null,
): UseSendPaymentReturn {
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const sendingRef = useRef(false)

  const clearResult = useCallback(() => {
    setResult(null)
  }, [])

  const sendPayment = useCallback(
    async (destination: string, amount: string): Promise<boolean> => {
      // Double-click guard — ref is synchronous, unlike React state
      if (sendingRef.current) return false

      if (!sourcePublicKey) {
        setResult({ status: 'error', message: 'Connect your wallet first' })
        return false
      }

      // Client-side validation before hitting the network
      const destinationError = validateDestination(destination)
      if (destinationError) {
        setResult({ status: 'error', message: destinationError })
        return false
      }

      const amountError = validateAmount(amount)
      if (amountError) {
        setResult({ status: 'error', message: amountError })
        return false
      }

      const trimmedAmount = amount.trim()
      const sendValue = Number(trimmedAmount)

      sendingRef.current = true
      setIsSending(true)
      setResult(null)

      try {
        const trimmedDestination = destination.trim()

        // Pre-check: payment requires the destination to exist on the ledger
        try {
          await withTimeout(
            horizonServer.loadAccount(trimmedDestination),
            HORIZON_TIMEOUT_MS,
            TIMEOUT_ERROR_MESSAGE,
          )
        } catch (destErr) {
          if (destErr instanceof NotFoundError) {
            setResult({ status: 'error', message: DESTINATION_NOT_FUNDED_MESSAGE })
            return false
          }
          throw destErr
        }

        const account = await withTimeout(
          horizonServer.loadAccount(sourcePublicKey),
          HORIZON_TIMEOUT_MS,
          TIMEOUT_ERROR_MESSAGE,
        )

        // Client-side balance check before building the transaction
        const native = account.balances.find(
          (entry) => entry.asset_type === 'native',
        )
        const available = Number(native?.balance ?? 0)

        if (sendValue > available) {
          setResult({ status: 'error', message: 'Amount exceeds available balance' })
          return false
        }

        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.payment({
              destination: trimmedDestination,
              asset: Asset.native(),
              amount: trimmedAmount,
            }),
          )
          .setTimeout(30)
          .build()

        const signedResponse = await signTransaction(transaction.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
          address: sourcePublicKey,
        })

        if (signedResponse.error || !signedResponse.signedTxXdr) {
          setResult({
            status: 'error',
            message: formatFreighterError(
              signedResponse.error,
              'Freighter signature denied or could not be obtained',
            ),
          })
          return false
        }

        const signedTransaction = TransactionBuilder.fromXDR(
          signedResponse.signedTxXdr,
          NETWORK_PASSPHRASE,
        )

        const submitResponse = await withTimeout(
          horizonServer.submitTransaction(signedTransaction),
          HORIZON_TIMEOUT_MS,
          TIMEOUT_ERROR_MESSAGE,
        )

        setResult({ status: 'success', hash: submitResponse.hash })
        return true
      } catch (err) {
        const message = parseSubmitError(err)
        setResult({ status: 'error', message })
        console.error('sendPayment failed:', err)
        return false
      } finally {
        sendingRef.current = false
        setIsSending(false)
      }
    },
    [sourcePublicKey],
  )

  return {
    isSending,
    result,
    sendPayment,
    clearResult,
  }
}
