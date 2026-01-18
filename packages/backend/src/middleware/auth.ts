import type { FastifyReply, FastifyRequest } from "fastify";

export interface AuthUser {
	id: string;
	email: string;
	role: "admin" | "viewer";
}

// Extend @fastify/jwt's FastifyJWT interface for proper typing
declare module "@fastify/jwt" {
	interface FastifyJWT {
		payload: AuthUser;
		user: AuthUser;
	}
}

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> {
	try {
		await request.jwtVerify();
	} catch (err) {
		request.log.error(err, "Auth middleware error");
		reply.status(401).send({ error: "Unauthorized" });
	}
}

export async function adminMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> {
	try {
		await request.jwtVerify();
		if (request.user.role !== "admin") {
			reply.status(403).send({ error: "Forbidden: Admin access required" });
		}
	} catch (err) {
		request.log.error(err, "Admin middleware error");
		reply.status(401).send({ error: "Unauthorized" });
	}
}
