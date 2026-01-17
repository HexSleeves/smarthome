import { useState } from "react"

type Ring2FAFormProps = {
  prompt: string
  onSubmit: (code: string) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  isCancelling: boolean
  error: string | null
}

export function Ring2FAForm({
  prompt,
  onSubmit,
  onCancel,
  isSubmitting,
  isCancelling,
  error,
}: Ring2FAFormProps) {
  const [code, setCode] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(code)
    setCode("") // Clear on submit for retry
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
        <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">
          2FA Code Required
        </p>
        <p className="text-blue-600 dark:text-blue-400 text-sm">
          {prompt}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Verification Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="input w-full text-center text-2xl tracking-widest"
          placeholder="000000"
          maxLength={6}
          autoFocus
          required
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || code.length < 4}
          className="btn btn-primary flex-1"
        >
          {isSubmitting ? "Verifying..." : "Verify Code"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
