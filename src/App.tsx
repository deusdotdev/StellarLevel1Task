/**
 * Main app shell.
 * Wallet, balance, and payment state are orchestrated here so components stay in sync.
 */
import { useCallback, useState } from 'react'
import { ConnectButton } from './components/ConnectButton'
import { BalanceCard } from './components/BalanceCard'
import { PaymentForm } from './components/PaymentForm'
import { TxResult } from './components/TxResult'
import { useWallet } from './hooks/useWallet'
import { useBalance } from './hooks/useBalance'
import type { PaymentResult } from './hooks/useSendPayment'

function App() {
  const wallet = useWallet()
  const { balance, isLoading, error, fetchBalance } = useBalance(wallet.publicKey)
  const [txResult, setTxResult] = useState<PaymentResult | null>(null)

  const handlePaymentSuccess = useCallback(() => {
    void fetchBalance()
  }, [fetchBalance])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        Stellar Payment dApp
      </h1>
      <ConnectButton {...wallet} />
      <BalanceCard
        publicKey={wallet.publicKey}
        balance={balance}
        isLoading={isLoading}
        error={error}
        onRetry={fetchBalance}
      />
      <PaymentForm
        sourcePublicKey={wallet.publicKey}
        onSuccess={handlePaymentSuccess}
        onResultChange={setTxResult}
      />
      <TxResult result={txResult} />
    </main>
  )
}

export default App
