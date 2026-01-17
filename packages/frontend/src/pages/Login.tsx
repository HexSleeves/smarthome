import { useState } from "react";
import { Home, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

export function LoginPage() {
	const [isRegister, setIsRegister] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const { login, register } = useAuthStore();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			if (isRegister) {
				await register(email, password, name || undefined);
			} else {
				await login(email, password);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white mb-4">
						<Home className="w-8 h-8" />
					</div>
					<h1 className="text-2xl font-bold">Smart Home</h1>
					<p className="text-gray-500 mt-1">
						Control your devices from anywhere
					</p>
				</div>

				{/* Form */}
				<div className="card p-6">
					<form onSubmit={handleSubmit} className="space-y-4">
						<h2 className="text-xl font-semibold text-center mb-6">
							{isRegister ? "Create Account" : "Welcome Back"}
						</h2>

						{error && (
							<div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
								{error}
							</div>
						)}

						{isRegister && (
							<div>
								<label className="block text-sm font-medium mb-1">Name</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="input w-full"
									placeholder="Your name"
								/>
							</div>
						)}

						<div>
							<label className="block text-sm font-medium mb-1">Email</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="input w-full"
								placeholder="you@example.com"
								required
							/>
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Password</label>
							<div className="relative">
								<input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="input w-full pr-10"
									placeholder="••••••••"
									required
									minLength={8}
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
						</div>

						<button
							type="submit"
							disabled={loading}
							className="btn btn-primary w-full"
						>
							{loading
								? "Please wait..."
								: isRegister
									? "Create Account"
									: "Sign In"}
						</button>
					</form>

					<div className="mt-6 text-center">
						<button
							onClick={() => {
								setIsRegister(!isRegister);
								setError("");
							}}
							className="text-sm text-primary-600 hover:text-primary-700"
						>
							{isRegister
								? "Already have an account? Sign in"
								: "Don't have an account? Create one"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
