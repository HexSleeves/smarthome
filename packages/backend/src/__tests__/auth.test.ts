import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { User } from "@smarthome/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import superjson from "superjson";
import { appRouter } from "../trpc/routers/index.js";
import type { TRPCContext } from "../trpc/trpc.js";

const JWT_SECRET = "test-jwt-secret-12345";

// tRPC response types with superjson
interface TRPCSuccessResponse<T> {
	result: { data: { json: T } };
}

interface TRPCErrorResponse {
	error: {
		json: {
			message: string;
			code: number;
			data: { code: string; httpStatus: number };
		};
	};
}

type TRPCResponse<T> = TRPCSuccessResponse<T> | TRPCErrorResponse;

function isSuccess<T>(resp: TRPCResponse<T>): resp is TRPCSuccessResponse<T> {
	return "result" in resp;
}

function isError<T>(resp: TRPCResponse<T>): resp is TRPCErrorResponse {
	return "error" in resp;
}

describe("auth router", () => {
	let app: FastifyInstance;
	let testUserEmail: string;

	beforeAll(async () => {
		app = Fastify({ logger: false });

		await app.register(cors, { origin: true, credentials: true });
		await app.register(formbody);
		await app.register(jwt, { secret: JWT_SECRET });

		await app.register(fastifyTRPCPlugin, {
			prefix: "/api/trpc",
			trpcOptions: {
				router: appRouter,
				createContext: async ({
					req,
					res,
				}: {
					req: FastifyRequest;
					res: FastifyReply;
				}): Promise<TRPCContext> => {
					let user: User | null = null;

					const authHeader = req.headers.authorization;
					if (authHeader?.startsWith("Bearer ")) {
						try {
							const decoded = app.jwt.verify<User>(authHeader.slice(7));
							user = {
								id: decoded.id,
								email: decoded.email,
								name: decoded.name,
								role: decoded.role,
							};
						} catch {
							// Invalid token
						}
					}

					const signJwt = (payload: object, options?: { expiresIn?: string }) =>
						(app.jwt.sign as (p: unknown, o?: unknown) => string)(
							payload,
							options,
						);

					return { req, res, user, signJwt };
				},
			},
		});

		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		// Generate unique email for each test to avoid conflicts
		testUserEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
	});

	/**
	 * Make a tRPC mutation call
	 */
	async function trpcMutation<T>(
		path: string,
		input: unknown,
		token?: string,
	): Promise<TRPCResponse<T>> {
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		if (token) {
			headers.authorization = `Bearer ${token}`;
		}

		const response = await app.inject({
			method: "POST",
			url: `/api/trpc/${path}`,
			headers,
			payload: superjson.stringify(input),
		});

		return JSON.parse(response.body) as TRPCResponse<T>;
	}

	/**
	 * Make a tRPC query call
	 */
	async function trpcQuery<T>(
		path: string,
		token?: string,
	): Promise<TRPCResponse<T>> {
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		if (token) {
			headers.authorization = `Bearer ${token}`;
		}

		const response = await app.inject({
			method: "GET",
			url: `/api/trpc/${path}`,
			headers,
		});

		return JSON.parse(response.body) as TRPCResponse<T>;
	}

	describe("register", () => {
		it("creates a new user and returns tokens", async () => {
			const result = await trpcMutation<{
				user: { id: string; email: string; role: string };
				accessToken: string;
				refreshToken: string;
			}>("auth.register", {
				email: testUserEmail,
				password: "password123",
				name: "Test User",
			});

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;

			const data = result.result.data.json;
			expect(data.user.email).toBe(testUserEmail);
			expect(data.user.id).toBeDefined();
			expect(data.accessToken).toBeDefined();
			expect(data.refreshToken).toBeDefined();

			// Verify access token is valid JWT
			const decoded = app.jwt.verify(data.accessToken) as {
				id: string;
				email: string;
			};
			expect(decoded.id).toBe(data.user.id);
			expect(decoded.email).toBe(testUserEmail);
		});

		it("rejects duplicate email", async () => {
			// First registration
			await trpcMutation("auth.register", {
				email: testUserEmail,
				password: "password123",
			});

			// Second registration with same email
			const result = await trpcMutation("auth.register", {
				email: testUserEmail,
				password: "password456",
			});

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("BAD_REQUEST");
		});

		it("rejects short password", async () => {
			const result = await trpcMutation("auth.register", {
				email: testUserEmail,
				password: "short",
			});

			expect(isError(result)).toBe(true);
		});

		it("rejects invalid email", async () => {
			const result = await trpcMutation("auth.register", {
				email: "not-an-email",
				password: "password123",
			});

			expect(isError(result)).toBe(true);
		});
	});

	describe("login", () => {
		it("returns tokens for valid credentials", async () => {
			// Register first
			await trpcMutation("auth.register", {
				email: testUserEmail,
				password: "password123",
			});

			// Login
			const result = await trpcMutation<{
				user: { id: string; email: string };
				accessToken: string;
				refreshToken: string;
			}>("auth.login", {
				email: testUserEmail,
				password: "password123",
			});

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;

			const data = result.result.data.json;
			expect(data.user.email).toBe(testUserEmail);
			expect(data.accessToken).toBeDefined();
			expect(data.refreshToken).toBeDefined();
		});

		it("rejects invalid password", async () => {
			await trpcMutation("auth.register", {
				email: testUserEmail,
				password: "password123",
			});

			const result = await trpcMutation("auth.login", {
				email: testUserEmail,
				password: "wrongpassword",
			});

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});

		it("rejects non-existent user", async () => {
			const result = await trpcMutation("auth.login", {
				email: "nonexistent@example.com",
				password: "password123",
			});

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});
	});

	describe("refresh", () => {
		it("returns new access token with valid refresh token", async () => {
			// Register and get tokens
			const registerResult = await trpcMutation<{
				refreshToken: string;
			}>("auth.register", {
				email: testUserEmail,
				password: "password123",
			});

			expect(isSuccess(registerResult)).toBe(true);
			if (!isSuccess(registerResult)) return;

			const refreshToken = registerResult.result.data.json.refreshToken;

			// Refresh
			const result = await trpcMutation<{ accessToken: string }>(
				"auth.refresh",
				{ refreshToken },
			);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;

			expect(result.result.data.json.accessToken).toBeDefined();

			// Verify the new token is valid
			const decoded = app.jwt.verify(
				result.result.data.json.accessToken,
			) as {
				email: string;
			};
			expect(decoded.email).toBe(testUserEmail);
		});

		it("rejects invalid refresh token", async () => {
			const result = await trpcMutation("auth.refresh", {
				refreshToken: "invalid-refresh-token",
			});

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});
	});

	describe("me (protected route)", () => {
		it("returns user info with valid token", async () => {
			// Register and get token
			const registerResult = await trpcMutation<{
				user: { id: string };
				accessToken: string;
			}>("auth.register", {
				email: testUserEmail,
				password: "password123",
				name: "Test Name",
			});

			expect(isSuccess(registerResult)).toBe(true);
			if (!isSuccess(registerResult)) return;

			const token = registerResult.result.data.json.accessToken;

			// Call protected route
			const result = await trpcQuery<{
				id: string;
				email: string;
				name: string;
			}>("auth.me", token);

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;

			expect(result.result.data.json.email).toBe(testUserEmail);
			expect(result.result.data.json.name).toBe("Test Name");
		});

		it("rejects request without token", async () => {
			const result = await trpcQuery("auth.me");

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});

		it("rejects request with invalid token", async () => {
			const result = await trpcQuery("auth.me", "invalid-token");

			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});

		it("rejects request with expired token", async () => {
			// Create a token that expires in 1 second (0s doesn't add exp claim)
			const expiredToken = app.jwt.sign(
				{ id: "test", email: "test@test.com", role: "viewer" },
				{ expiresIn: "1s" },
			);

			// Wait for token to expire
			await new Promise((r) => setTimeout(r, 1100));

			const result = await trpcQuery("auth.me", expiredToken);

			// Expired tokens fail JWT verification, so user will be null -> UNAUTHORIZED
			expect(isError(result)).toBe(true);
			if (!isError(result)) return;
			// The expired token causes JWT verification to fail silently,
			// resulting in user=null, which triggers UNAUTHORIZED in protectedProcedure
			expect(result.error.json.data.code).toBe("UNAUTHORIZED");
		});
	});

	describe("logout", () => {
		it("invalidates refresh token on logout", async () => {
			// Register
			const registerResult = await trpcMutation<{
				accessToken: string;
				refreshToken: string;
			}>("auth.register", {
				email: testUserEmail,
				password: "password123",
			});

			expect(isSuccess(registerResult)).toBe(true);
			if (!isSuccess(registerResult)) return;

			const { accessToken, refreshToken } = registerResult.result.data.json;

			// Logout
			const logoutResult = await trpcMutation<{ success: boolean }>(
				"auth.logout",
				{ refreshToken },
				accessToken,
			);

			expect(isSuccess(logoutResult)).toBe(true);
			if (!isSuccess(logoutResult)) return;
			expect(logoutResult.result.data.json.success).toBe(true);

			// Try to use refresh token - should fail
			const refreshResult = await trpcMutation("auth.refresh", { refreshToken });

			expect(isError(refreshResult)).toBe(true);
			if (!isError(refreshResult)) return;
			expect(refreshResult.error.json.data.code).toBe("UNAUTHORIZED");
		});
	});
});
