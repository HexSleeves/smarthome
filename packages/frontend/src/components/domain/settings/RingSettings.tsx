import { Bell, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

	useEffect(() => {
		if (pending2FA) {
			setRequiresTwoFactor(true);
			setTwoFactorPrompt(
				"A 2FA session is pending. Please enter the code sent to your phone.",
			);
		}
	}, [pending2FA]);

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

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<Bell className="w-5 h-5" />
					Ring
				</CardTitle>
				<ConnectionBadge connected={connected} isLoading={statusLoading} />
			</CardHeader>
			<CardContent>
				{connected ? (
					<ConnectedState
						onDisconnect={disconnect}
						isDisconnecting={isDisconnecting}
					/>
				) : hasCredentials ? (
					<StoredCredentialsState
						onConnect={handleConnect}
						isConnecting={isConnecting}
						error={error}
					/>
				) : requiresTwoFactor ? (
					<Ring2FAForm
						prompt={twoFactorPrompt}
						onSubmit={handle2FA}
						onCancel={handleCancel2FA}
						isSubmitting={isSubmitting2FA}
						isCancelling={isCancelling2FA}
						error={error}
					/>
				) : (
					<RingAuthForm
						onSubmit={handleAuth}
						isSubmitting={isAuthenticating}
						error={error}
					/>
				)}
			</CardContent>
		</Card>
	);
}

function ConnectionBadge({
	connected,
	isLoading,
}: {
	connected: boolean;
	isLoading: boolean;
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
