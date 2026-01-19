import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type RingAuthFormProps = {
	onSubmit: (email: string, password: string) => Promise<void>;
	isSubmitting: boolean;
	error: string | null;
};

export function RingAuthForm({
	onSubmit,
	isSubmitting,
	error,
}: RingAuthFormProps) {
	const [showPassword, setShowPassword] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value.email, value.password);
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
			<p className="text-muted-foreground">
				Enter your Ring account credentials.
			</p>

			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<form.Field
				name="email"
				validators={{
					onChange: ({ value }) =>
						!value
							? "Email is required"
							: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
								? "Invalid email format"
								: undefined,
				}}
				children={(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Email</Label>
						<Input
							id={field.name}
							name={field.name}
							type="email"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="your@email.com"
							required
						/>
						{field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">
								{field.state.meta.errors.join(", ")}
							</p>
						)}
					</div>
				)}
			/>

			<form.Field
				name="password"
				validators={{
					onChange: ({ value }) =>
						!value ? "Password is required" : undefined,
				}}
				children={(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Password</Label>
						<div className="relative">
							<Input
								id={field.name}
								name={field.name}
								type={showPassword ? "text" : "password"}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="pr-10"
								placeholder="••••••••"
								required
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
								onClick={() => setShowPassword(!showPassword)}
							>
								{showPassword ? (
									<EyeOff className="w-5 h-5 text-muted-foreground" />
								) : (
									<Eye className="w-5 h-5 text-muted-foreground" />
								)}
							</Button>
						</div>
						{field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">
								{field.state.meta.errors.join(", ")}
							</p>
						)}
					</div>
				)}
			/>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
				children={([canSubmit]) => (
					<Button type="submit" disabled={!canSubmit || isSubmitting}>
						{isSubmitting ? "Connecting..." : "Connect Ring"}
					</Button>
				)}
			/>
		</form>
	);
}
