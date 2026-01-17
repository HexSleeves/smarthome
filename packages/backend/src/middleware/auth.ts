import { FastifyRequest, FastifyReply } from "fastify";

export interface AuthUser {
	id: string;
	email: string;
	role: "admin" | "viewer";
}

declare module "fastify" {
	interface FastifyRequest {
		user?: AuthUser;
	}
}

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		await request.jwtVerify();
	} catch (err) {
		reply.status(401).send({ error: "Unauthorized" });
	}
}

export async function adminMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		await request.jwtVerify();
		const user = request.user as AuthUser;
		if (user.role !== "admin") {
			reply.status(403).send({ error: "Forbidden: Admin access required" });
		}
	} catch (err) {
		reply.status(401).send({ error: "Unauthorized" });
	}
}
