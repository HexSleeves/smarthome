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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoborockAuth, useRoborockStatus } from "@/hooks";

type AuthStep = "credentials" | "2fa";

function StatusBadge({
	isLoading,
	connected,
}: {
	isLoading: boolean;
	connected: boolean;
}) {
	if (isLoading) {
		return <Loader2 className="w-5 h-5 animate-spin" />;
	}
	if (connected) {
		return (
			<Badge variant="success" className="gap-1">
				<CheckCircle className="w-3 h-3" />
				Connected
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="gap-1">
			<XCircle className="w-3 h-3" />
			Disconnected
		</Badge>
	);
}

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

	const renderContent = () => {
		if (connected) {
			return (
				<div className="space-y-4">
					<p className="text-muted-foreground">
						Your Roborock account is connected.
					</p>
					<Button
						variant="secondary"
						onClick={() => disconnect()}
						disabled={isDisconnecting}
					>
						{isDisconnecting ? "Disconnecting..." : "Disconnect"}
					</Button>
				</div>
			);
		}

		if (hasCredentials) {
			return (
				<div className="space-y-4">
					<p className="text-muted-foreground">
						Credentials stored. Click connect to re-establish connection.
					</p>
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<Button onClick={handleConnect} disabled={isConnecting}>
						{isConnecting ? "Connecting..." : "Connect"}
					</Button>
				</div>
			);
		}

		if (authStep === "2fa") {
			return (
				<div className="space-y-4">
					<Alert variant="info">
						<Mail className="w-4 h-4" />
						<AlertTitle>Verification Required</AlertTitle>
						<AlertDescription>
							A verification code has been sent to{" "}
							<span className="font-medium">{pendingEmail}</span>. Please enter
							it below.
						</AlertDescription>
					</Alert>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="verification-code">Verification Code</Label>
						<Input
							id="verification-code"
							type="text"
							value={verificationCode}
							onChange={(e) => setVerificationCode(e.target.value)}
							className="font-mono text-center text-lg tracking-widest"
							placeholder="000000"
							maxLength={6}
							autoComplete="one-time-code"
						/>
					</div>

					<div className="flex gap-2">
						<Button
							onClick={handleVerify2FA}
							disabled={isVerifying2FACode || !verificationCode}
							className="flex-1"
						>
							{isVerifying2FACode ? "Verifying..." : "Verify"}
						</Button>
						<Button variant="secondary" onClick={handleBackToCredentials}>
							Back
						</Button>
					</div>

					<Button
						variant="link"
						onClick={handleResendCode}
						disabled={isSending2FACode}
						className="px-0"
					>
						{isSending2FACode ? "Sending..." : "Resend code"}
					</Button>
				</div>
			);
		}

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
					Enter your Roborock account credentials.
				</p>

				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form.Field
					name="email"
					validators={{
						onChange: ({ value }) => {
							if (!value) return "Email is required";
							if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
								return "Invalid email format";
							}
							return undefined;
						},
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
								placeholder="your@email.com"
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
							!value ? "Password is required" : undefined,
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
					{([canSubmit]) => (
						<Button
							type="submit"
							disabled={!canSubmit || isAuthenticating || isSending2FACode}
						>
							{isAuthenticating || isSending2FACode
								? "Connecting..."
								: "Connect Roborock"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<Wifi className="w-5 h-5" />
					Roborock
				</CardTitle>
				<StatusBadge isLoading={statusLoading} connected={connected} />
			</CardHeader>
			<CardContent>{renderContent()}</CardContent>
		</Card>
	);
}
