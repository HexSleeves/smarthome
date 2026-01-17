import { CheckCircle, Eye, EyeOff, Loader2, Wifi, XCircle } from "lucide-react"
import { useState } from "react"
import { useRoborockStatus, useRoborockAuth } from "@/hooks"

export function RoborockSettings() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const { connected, hasCredentials, isLoading: statusLoading } = useRoborockStatus()
  const {
    authenticate,
    connect,
    disconnect,
    isAuthenticating,
    isConnecting,
    isDisconnecting,
  } = useRoborockAuth()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await authenticate(email, password)
      setEmail("")
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
    }
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
          <Wifi className="w-5 h-5" />
          Roborock
        </h2>
        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : connected ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-500">
            <XCircle className="w-4 h-4" />
            Disconnected
          </span>
        )}
      </div>

      {connected ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Your Roborock account is connected.
          </p>
          <button
            onClick={() => disconnect()}
            disabled={isDisconnecting}
            className="btn btn-secondary"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      ) : hasCredentials ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Credentials stored. Click connect to re-establish connection.
          </p>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn btn-primary"
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleAuth} className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Enter your Roborock account credentials.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="btn btn-primary"
          >
            {isAuthenticating ? "Connecting..." : "Connect Roborock"}
          </button>
        </form>
      )}
    </div>
  )
}
