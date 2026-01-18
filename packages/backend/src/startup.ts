import type { FastifyInstance } from "fastify";
import { getUsersWithCredentials } from "./db/queries.js";
import { ringService } from "./services/ring.js";
import { roborockService } from "./services/roborock.js";

export async function reconnectStoredCredentials(
	fastify: FastifyInstance,
): Promise<void> {
	const ringUsers = getUsersWithCredentials("ring");
	fastify.log.info(`Found ${ringUsers.length} users with Ring credentials`);

	for (const userId of ringUsers) {
		try {
			const success = await ringService.connectWithStoredCredentials(userId);
			fastify.log.info(
				{ userId },
				success
					? "Ring auto-reconnect successful"
					: "Ring auto-reconnect failed",
			);
		} catch (error) {
			fastify.log.error({ userId, err: error }, "Ring auto-reconnect error");
		}
	}

	const roborockUsers = getUsersWithCredentials("roborock");
	fastify.log.info(
		`Found ${roborockUsers.length} users with Roborock credentials`,
	);

	for (const userId of roborockUsers) {
		try {
			const success =
				await roborockService.connectWithStoredCredentials(userId);
			fastify.log.info(
				{ userId },
				success
					? "Roborock auto-reconnect successful"
					: "Roborock auto-reconnect failed",
			);
		} catch (error) {
			fastify.log.error(
				{ userId, err: error },
				"Roborock auto-reconnect error",
			);
		}
	}
}
