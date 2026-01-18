import type { FastifyInstance } from "fastify";
import { getUsersWithCredentials } from "./db/queries.js";
import { ringService } from "./services/ring.js";
import { roborockService } from "./services/roborock.js";

/**
 * Reconnect services for users with stored credentials.
 * Called after the server starts to restore connections from previous sessions.
 */
export async function reconnectStoredCredentials(
	fastify: FastifyInstance,
): Promise<void> {
	// Reconnect Ring users
	const ringUsers = getUsersWithCredentials("ring");
	fastify.log.info(`Found ${ringUsers.length} users with Ring credentials`);

	for (const userId of ringUsers) {
		try {
			const success = await ringService.connectWithStoredCredentials(userId);
			if (success) {
				fastify.log.info({ userId }, "Ring auto-reconnect successful");
			} else {
				fastify.log.warn({ userId }, "Ring auto-reconnect failed - credentials may be invalid");
			}
		} catch (error) {
			fastify.log.error({ userId, err: error }, "Ring auto-reconnect error");
		}
	}

	// Reconnect Roborock users
	const roborockUsers = getUsersWithCredentials("roborock");
	fastify.log.info(`Found ${roborockUsers.length} users with Roborock credentials`);

	for (const userId of roborockUsers) {
		try {
			const success = await roborockService.connectWithStoredCredentials(userId);
			if (success) {
				fastify.log.info({ userId }, "Roborock auto-reconnect successful");
			} else {
				fastify.log.warn({ userId }, "Roborock auto-reconnect failed - credentials may be invalid");
			}
		} catch (error) {
			fastify.log.error({ userId, err: error }, "Roborock auto-reconnect error");
		}
	}
}
