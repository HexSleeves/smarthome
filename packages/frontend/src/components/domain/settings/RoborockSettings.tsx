import { useForm } from "@tanstack/react-form";
import {
	CheckCircle,
	Eye,
	EyeOff,
	Loader2,
	Mail,
	Wifi,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { FieldError } from "@/components/ui";
import { useRoborockAuth, useRoborockStatus } from "@/hooks";

type AuthStep = "credentials" | "2fa";

export function RoborockSettings() {
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [authStep, setAuthStep] = useState<AuthStep>("credentials");
	const [pendingEmail, setPendingEmail] = useState("");
	const [verificationCode, setVerificationCode] = useState("");

	const {
		connected,
		hasCredentials,
		isLoading: statusLoading,
	} = useRoborockStatus();
	const {
		authenticate,
		send2FACode,
		verify2FACode,
		connect,
		disconnect,
		isAuthenticating,
		isSending2FACode,
		isVerifying2FACode,
		isConnecting,
		isDisconnecting,
	} = useRoborockAuth();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const result = await authenticate(value.email, value.password);
				if (result.twoFactorRequired) {
					// 2FA required - send code and switch to 2FA step
					setPendingEmail(value.email);
					try {
						await send2FACode(value.email);
						setAuthStep("2fa");
					} catch (err) {
						setError(
							err instanceof Error
								? err.message
								: "Failed to send verification code",
						);
					}
				} else {
					// Success - reset form
					form.reset();
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Authentication failed");
			}
		},
	});

	const handleVerify2FA = async () => {
		setError("");
		try {
			await verify2FACode(verificationCode);
			// Success - reset everything
			form.reset();
			setAuthStep("credentials");
			setPendingEmail("");
			setVerificationCode("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Verification failed");
		}
	};

	const handleResendCode = async () => {
		setError("");
		try {
			await send2FACode(pendingEmail);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to resend code");
		}
	};

	const handleBackToCredentials = () => {
		setAuthStep("credentials");
		setPendingEmail("");
		setVerificationCode("");
		setError("");
	};

	const handleConnect = async () => {
		setError("");
		try {
			await connect();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Connection failed");
		}
	};

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
						type="button"
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
						type="button"
						onClick={handleConnect}
						disabled={isConnecting}
						className="btn btn-primary"
					>
						{isConnecting ? "Connecting..." : "Connect"}
					</button>
				</div>
			) : authStep === "2fa" ? (
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
						<Mail className="w-5 h-5" />
						<span className="font-medium">Verification Required</span>
					</div>
					<p className="text-gray-600 dark:text-gray-400">
						A verification code has been sent to{" "}
						<span className="font-medium">{pendingEmail}</span>. Please enter it
						below.
					</p>

					{error && (
						<div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
							{error}
						</div>
					)}

					<div>
						<label
							htmlFor="verification-code"
							className="block text-sm font-medium mb-1"
						>
							Verification Code
						</label>
						<input
							id="verification-code"
							type="text"
							value={verificationCode}
							onChange={(e) => setVerificationCode(e.target.value)}
							className="input w-full font-mono text-center text-lg tracking-widest"
							placeholder="000000"
							maxLength={6}
							autoComplete="one-time-code"
						/>
					</div>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleVerify2FA}
							disabled={isVerifying2FACode || !verificationCode}
							className="btn btn-primary flex-1"
						>
							{isVerifying2FACode ? "Verifying..." : "Verify"}
						</button>
						<button
							type="button"
							onClick={handleBackToCredentials}
							className="btn btn-secondary"
						>
							Back
						</button>
					</div>

					<button
						type="button"
						onClick={handleResendCode}
						disabled={isSending2FACode}
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						{isSending2FACode ? "Sending..." : "Resend code"}
					</button>
				</div>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<p className="text-gray-600 dark:text-gray-400">
						Enter your Roborock account credentials.
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
								!value
									? "Email is required"
									: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
										? "Invalid email format"
										: undefined,
						}}
						children={(field) => (
							<div>
								<label
									htmlFor={field.name}
									className="block text-sm font-medium mb-1"
								>
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
							onChange: ({ value }) =>
								!value ? "Password is required" : undefined,
						}}
						children={(field) => (
							<div>
								<label
									htmlFor={field.name}
									className="block text-sm font-medium mb-1"
								>
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
										{showPassword ? (
											<EyeOff className="w-5 h-5" />
										) : (
											<Eye className="w-5 h-5" />
										)}
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
								disabled={!canSubmit || isAuthenticating || isSending2FACode}
								className="btn btn-primary"
							>
								{isAuthenticating || isSending2FACode
									? "Connecting..."
									: "Connect Roborock"}
							</button>
						)}
					/>
				</form>
			)}
		</div>
	);
}
