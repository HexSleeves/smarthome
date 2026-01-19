import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, Home } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";

export function LoginPage() {
	const [isRegister, setIsRegister] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");

	const { login, register } = useAuthStore();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				if (isRegister) {
					await register(value.email, value.password, value.name || undefined);
				} else {
					await login(value.email, value.password);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Authentication failed");
			}
		},
	});

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
						<Home className="w-8 h-8" />
					</div>
					<h1 className="text-2xl font-bold">Smart Home</h1>
					<p className="text-muted-foreground mt-1">
						Control your devices from anywhere
					</p>
				</div>

				{/* Form */}
				<Card>
					<CardHeader className="text-center">
						<CardTitle>
							{isRegister ? "Create Account" : "Welcome Back"}
						</CardTitle>
						<CardDescription>
							{isRegister
								? "Enter your details to create an account"
								: "Enter your credentials to sign in"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="space-y-4"
						>
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							{isRegister && (
								<form.Field name="name">
									{(field) => (
										<div className="space-y-2">
											<Label htmlFor={field.name}>Name</Label>
											<Input
												id={field.name}
												name={field.name}
												type="text"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Your name"
											/>
										</div>
									)}
								</form.Field>
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
							>
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Email</Label>
										<Input
											id={field.name}
											name={field.name}
											type="email"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="you@example.com"
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

							<form.Field
								name="password"
								validators={{
									onChange: ({ value }) =>
										!value
											? "Password is required"
											: value.length < 8
												? "Password must be at least 8 characters"
												: undefined,
								}}
							>
								{(field) => (
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
												minLength={8}
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
								selector={(state) => [state.canSubmit, state.isSubmitting]}
							>
								{([canSubmit, isSubmitting]) => (
									<Button
										type="submit"
										className="w-full"
										disabled={!canSubmit || isSubmitting}
									>
										{isSubmitting
											? "Please wait..."
											: isRegister
												? "Create Account"
												: "Sign In"}
									</Button>
								)}
							</form.Subscribe>
						</form>

						<div className="mt-6 text-center">
							<Button
								variant="link"
								onClick={() => {
									setIsRegister(!isRegister);
									setError("");
									form.reset();
								}}
							>
								{isRegister
									? "Already have an account? Sign in"
									: "Don't have an account? Create one"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
