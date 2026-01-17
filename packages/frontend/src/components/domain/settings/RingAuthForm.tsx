import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { FieldError } from "@/components/ui"

type RingAuthFormProps = {
  onSubmit: (email: string, password: string) => Promise<void>
  isSubmitting: boolean
  error: string | null
}

export function RingAuthForm({ onSubmit, isSubmitting, error }: RingAuthFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value.email, value.password)
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
      <p className="text-gray-600 dark:text-gray-400">
        Enter your Ring account credentials.
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            !value ? "Email is required" :
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Invalid email format" : undefined,
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name} className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="input w-full"
              placeholder="your@email.com"
              required
            />
            <FieldError field={field} />
          </div>
        )}
      />

      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => (!value ? "Password is required" : undefined),
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name} className="block text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id={field.name}
                name={field.name}
                type={showPassword ? "text" : "password"}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
            <FieldError field={field} />
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit]) => (
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? "Connecting..." : "Connect Ring"}
          </button>
        )}
      />
    </form>
  )
}
