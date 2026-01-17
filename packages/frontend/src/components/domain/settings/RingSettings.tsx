import { Bell, CheckCircle, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useRingStatus, useRingAuth } from "@/hooks"
import { RingAuthForm } from "./RingAuthForm"
import { Ring2FAForm } from "./Ring2FAForm"

export function RingSettings() {
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [twoFactorPrompt, setTwoFactorPrompt] = useState("")
  const [error, setError] = useState("")

  const { connected, hasCredentials, pending2FA, isLoading: statusLoading } = useRingStatus()
  const {
    authenticate,
    submit2FA,
    cancel2FA,
    connect,
    disconnect,
    isAuthenticating,
    isSubmitting2FA,
    isCancelling2FA,
    isConnecting,
    isDisconnecting,
  } = useRingAuth()

  useEffect(() => {
    if (pending2FA) {
      setRequiresTwoFactor(true)
      setTwoFactorPrompt("A 2FA session is pending. Please enter the code sent to your phone.")
    }
  }, [pending2FA])

  const handleAuth = async (email: string, password: string) => {
    setError("")
    try {
      const result = await authenticate(email, password)
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        setTwoFactorPrompt(result.prompt || "Please enter the 2FA code sent to your phone.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
    }
  }

  const handle2FA = async (code: string) => {
    setError("")
    try {
      await submit2FA(code)
      setRequiresTwoFactor(false)
      setTwoFactorPrompt("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code")
    }
  }

  const handleCancel2FA = async () => {
    await cancel2FA()
    setRequiresTwoFactor(false)
    setTwoFactorPrompt("")
    setError("")
  }

  const handleConnect = async () => {
    setError("")
    try {
      await connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Ring
        </h2>
        <ConnectionBadge connected={connected} isLoading={statusLoading} />
      </div>

      {connected ? (
        <ConnectedState onDisconnect={disconnect} isDisconnecting={isDisconnecting} />
      ) : hasCredentials ? (
        <StoredCredentialsState
          onConnect={handleConnect}
          isConnecting={isConnecting}
          error={error}
        />
      ) : requiresTwoFactor ? (
        <Ring2FAForm
          prompt={twoFactorPrompt}
          onSubmit={handle2FA}
          onCancel={handleCancel2FA}
          isSubmitting={isSubmitting2FA}
          isCancelling={isCancelling2FA}
          error={error}
        />
      ) : (
        <RingAuthForm
          onSubmit={handleAuth}
          isSubmitting={isAuthenticating}
          error={error}
        />
      )}
    </div>
  )
}

function ConnectionBadge({ connected, isLoading }: { connected: boolean; isLoading: boolean }) {
  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin" />
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <CheckCircle className="w-4 h-4" />
        Connected
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-gray-500">
      <XCircle className="w-4 h-4" />
      Disconnected
    </span>
  )
}

function ConnectedState({ onDisconnect, isDisconnecting }: { onDisconnect: () => void; isDisconnecting: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-600 dark:text-gray-400">Your Ring account is connected.</p>
      <button onClick={onDisconnect} disabled={isDisconnecting} className="btn btn-secondary">
        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
      </button>
    </div>
  )
}

function StoredCredentialsState({
  onConnect,
  isConnecting,
  error,
}: {
  onConnect: () => void
  isConnecting: boolean
  error: string
}) {
  return (
    <div className="space-y-4">
      <p className="text-gray-600 dark:text-gray-400">
        Credentials stored. Click connect to re-establish connection.
      </p>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      <button onClick={onConnect} disabled={isConnecting} className="btn btn-primary">
        {isConnecting ? "Connecting..." : "Connect"}
      </button>
    </div>
  )
}
