import {
	AlertTriangle,
	Bell,
	CheckCircle,
	Loader2,
	Smartphone,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRingAuth, useRingStatus } from "@/hooks";
import { Ring2FAForm } from "./Ring2FAForm";
import { RingAuthForm } from "./RingAuthForm";

export function RingSettings() {
	const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
	const [twoFactorPrompt, setTwoFactorPrompt] = useState("");
	const [error, setError] = useState("");

	const {
		connected,
		hasCredentials,
		pending2FA,
		isLoading: statusLoading,
	} = useRingStatus();
	const {
		authenticate,
		submit2FA,
		cancel2FA,
		connect,
		disconnect,
		isAuthenticating,
		isSubmitting2FA,
		isCancelling2FA,
		isConnecting,
		isDisconnecting,
	} = useRingAuth();

	// Auto-show 2FA form when there's a pending session
	useEffect(() => {
		if (pending2FA && !connected) {
			setRequiresTwoFactor(true);
			setTwoFactorPrompt(
				"A 2FA verification is pending from a previous login attempt. Please enter the code sent to your phone, or cancel to start over.",
			);
		}
	}, [pending2FA, connected]);

	const handleAuth = async (email: string, password: string) => {
		setError("");
		try {
			const result = await authenticate(email, password);
			if (result.requiresTwoFactor) {
				setRequiresTwoFactor(true);
				setTwoFactorPrompt(
					result.prompt || "Please enter the 2FA code sent to your phone.",
				);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		}
	};

	const handle2FA = async (code: string) => {
		setError("");
		try {
			await submit2FA(code);
			setRequiresTwoFactor(false);
			setTwoFactorPrompt("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Invalid code");
		}
	};

	const handleCancel2FA = async () => {
		await cancel2FA();
		setRequiresTwoFactor(false);
		setTwoFactorPrompt("");
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

	// Determine the connection badge state
	const getBadgeState = () => {
		if (statusLoading) return "loading";
		if (connected) return "connected";
		if (pending2FA) return "pending-2fa";
		return "disconnected";
	};

	const renderContent = () => {
		if (connected) {
			return (
				<ConnectedState
					onDisconnect={disconnect}
					isDisconnecting={isDisconnecting}
				/>
			);
		}

		if (hasCredentials && !requiresTwoFactor) {
			return (
				<StoredCredentialsState
					onConnect={handleConnect}
					isConnecting={isConnecting}
					error={error}
				/>
			);
		}

		if (requiresTwoFactor) {
			return (
				<Ring2FAForm
					prompt={twoFactorPrompt}
					onSubmit={handle2FA}
					onCancel={handleCancel2FA}
					isSubmitting={isSubmitting2FA}
					isCancelling={isCancelling2FA}
					error={error}
					isPending={pending2FA}
				/>
			);
		}

		return (
			<RingAuthForm
				onSubmit={handleAuth}
				isSubmitting={isAuthenticating}
				error={error}
			/>
		);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<Bell className="w-5 h-5" />
					Ring
				</CardTitle>
				<ConnectionBadge state={getBadgeState()} />
			</CardHeader>
			<CardContent>
				{/* Show pending 2FA alert at the top when applicable */}
				{pending2FA && !connected && !requiresTwoFactor && (
					<Pending2FAAlert
						onResume={() => {
							setRequiresTwoFactor(true);
							setTwoFactorPrompt(
								"Enter the 2FA code sent to your phone to complete authentication.",
							);
						}}
						onCancel={handleCancel2FA}
						isCancelling={isCancelling2FA}
					/>
				)}

				{renderContent()}
			</CardContent>
		</Card>
	);
}

function ConnectionBadge({
	state,
}: {
	state: "loading" | "connected" | "pending-2fa" | "disconnected";
}) {
	switch (state) {
		case "loading":
			return <Loader2 className="w-5 h-5 animate-spin" />;
		case "connected":
			return (
				<Badge variant="success" className="gap-1">
					<CheckCircle className="w-3 h-3" />
					Connected
				</Badge>
			);
		case "pending-2fa":
			return (
				<Badge variant="warning" className="gap-1">
					<Smartphone className="w-3 h-3" />
					2FA Pending
				</Badge>
			);
		default:
			return (
				<Badge variant="secondary" className="gap-1">
					<XCircle className="w-3 h-3" />
					Disconnected
				</Badge>
			);
	}
}

function Pending2FAAlert({
	onResume,
	onCancel,
	isCancelling,
}: {
	onResume: () => void;
	onCancel: () => void;
	isCancelling: boolean;
}) {
	return (
		<Alert variant="warning" className="mb-4">
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>2FA Verification Pending</AlertTitle>
			<AlertDescription className="mt-2">
				<p className="mb-3">
					A previous login attempt requires 2FA verification. Check your phone
					for the code.
				</p>
				<div className="flex gap-2">
					<Button size="sm" onClick={onResume}>
						<Smartphone className="w-4 h-4 mr-1" />
						Enter Code
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={onCancel}
						disabled={isCancelling}
					>
						{isCancelling ? "Cancelling..." : "Start Over"}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}

function ConnectedState({
	onDisconnect,
	isDisconnecting,
}: {
	onDisconnect: () => void;
	isDisconnecting: boolean;
}) {
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground">Your Ring account is connected.</p>
			<Button
				variant="secondary"
				onClick={onDisconnect}
				disabled={isDisconnecting}
			>
				{isDisconnecting ? "Disconnecting..." : "Disconnect"}
			</Button>
		</div>
	);
}

function StoredCredentialsState({
	onConnect,
	isConnecting,
	error,
}: {
	onConnect: () => void;
	isConnecting: boolean;
	error: string;
}) {
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
			<Button onClick={onConnect} disabled={isConnecting}>
				{isConnecting ? "Connecting..." : "Connect"}
			</Button>
		</div>
	);
}
