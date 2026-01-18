import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(8000),
	HOST: z.string().default("0.0.0.0"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),

	// Required secrets (must be 32+ chars)
	JWT_SECRET: z.string().min(32),
	COOKIE_SECRET: z.string().min(32),
	ENCRYPTION_SECRET: z.string().min(32),

	// Optional
	CORS_ORIGIN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
	// In development/test, provide defaults for secrets
	const isDev = process.env.NODE_ENV !== "production";

	if (isDev) {
		process.env.JWT_SECRET ??= "dev-jwt-secret-at-least-32-characters-long!!";
		process.env.COOKIE_SECRET ??= "dev-cookie-secret-at-least-32-characters!!";
		process.env.ENCRYPTION_SECRET ??= "dev-encryption-secret-32-characters!!";
	}

	const result = envSchema.safeParse(process.env);

	if (!result.success) {
		console.error("\n❌ Invalid environment variables:\n");
		const formatted = z.treeifyError(result.error);
		for (const [key, value] of Object.entries(formatted)) {
			if (key === "_errors") continue;
			const errors = (value as { _errors?: string[] })._errors;
			if (errors?.length) {
				console.error(`  ${key}: ${errors.join(", ")}`);
			}
		}
		console.error(
			"\nRequired in production: JWT_SECRET, COOKIE_SECRET, ENCRYPTION_SECRET (32+ chars each)\n",
		);
		process.exit(1);
	}

	return result.data;
}

export const config = loadConfig();
