import { useForm } from "@tanstack/react-form";
import { Clock, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Ring2FAFormProps = {
	prompt: string;
	onSubmit: (code: string) => Promise<void>;
	onCancel: () => void;
	isSubmitting: boolean;
	isCancelling: boolean;
	error: string | null;
	isPending?: boolean;
};

export function Ring2FAForm({
	prompt,
	onSubmit,
	onCancel,
	isSubmitting,
	isCancelling,
	error,
	isPending,
}: Ring2FAFormProps) {
	const form = useForm({
		defaultValues: {
			code: "",
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value.code);
			form.reset(); // Clear on submit for retry
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<Alert variant={isPending ? "warning" : "info"}>
				{isPending ? (
					<Clock className="h-4 w-4" />
				) : (
					<Smartphone className="h-4 w-4" />
				)}
				<AlertTitle>
					{isPending ? "Pending 2FA Verification" : "2FA Code Required"}
				</AlertTitle>
				<AlertDescription>{prompt}</AlertDescription>
			</Alert>

			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<form.Field
				name="code"
				validators={{
					onChange: ({ value }) => {
						const cleaned = String(value).replaceAll(/\D/g, "");
						if (!cleaned) return "Code is required";
						if (cleaned.length < 4) return "Code must be at least 4 digits";
						return undefined;
					},
				}}
			>
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Verification Code</Label>
						<Input
							id={field.name}
							name={field.name}
							type="text"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(e.target.value.replaceAll(/\D/g, ""))
							}
							className="text-center text-2xl tracking-widest"
							placeholder="000000"
							maxLength={6}
							autoFocus
							required
						/>
						{field.state.meta.isTouched &&
							field.state.meta.errors.length > 0 && (
								<p className="text-sm text-destructive">
									{field.state.meta.errors.join(", ")}
								</p>
							)}
					</div>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.values.code]}
			>
				{([canSubmit, code]) => (
					<div className="flex gap-2">
						<Button
							type="submit"
							className="flex-1"
							disabled={
								!canSubmit || isSubmitting || (code as string).length < 4
							}
						>
							{isSubmitting ? "Verifying..." : "Verify Code"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={onCancel}
							disabled={isCancelling}
						>
							{isCancelling ? "Cancelling..." : isPending ? "Start Over" : "Cancel"}
						</Button>
					</div>
				)}
			</form.Subscribe>

			{isPending && (
				<p className="text-xs text-muted-foreground text-center">
					Code was sent to your phone during a previous login attempt.
					If expired, click "Start Over" to request a new code.
				</p>
			)}
		</form>
	);
}
