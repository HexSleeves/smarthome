import { Loader2 } from "lucide-react"
import { clsx } from "clsx"

type SpinnerProps = {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <Loader2
      className={clsx(
        "animate-spin text-primary-600",
        sizeClasses[size],
        className
      )}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
