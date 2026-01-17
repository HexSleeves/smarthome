import { useForm } from "@tanstack/react-form"
import { FieldError } from "@/components/ui"

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
  const form = useForm({
    defaultValues: {
      code: "",
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value.code)
      form.reset() // Clear on submit for retry
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
        <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">
          2FA Code Required
        </p>
        <p className="text-blue-600 dark:text-blue-400 text-sm">{prompt}</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form.Field
        name="code"
        validators={{
          onChange: ({ value }) => {
            const cleaned = value.replace(/\D/g, "")
            if (!cleaned) return "Code is required"
            if (cleaned.length < 4) return "Code must be at least 4 digits"
            return undefined
          },
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name} className="block text-sm font-medium mb-1">
              Verification Code
            </label>
            <input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value.replace(/\D/g, ""))}
              className="input w-full text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              autoFocus
              required
            />
            <FieldError field={field} />
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.values.code]}
        children={([canSubmit, code]) => (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting || (code as string).length < 4}
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
        )}
      />
    </form>
  )
}
