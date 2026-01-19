import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { FastifyServerOptions } from "fastify";
import type { PinoLoggerOptions } from "fastify/types/logger.js";
import type { Config } from "./config.js";

/**
 * Creates logger configuration for Fastify.
 * Supports console logging and optional file logging.
 */
export function createLoggerConfig(
	config: Config,
): FastifyServerOptions["logger"] {
	const targets: Array<{
		target: string;
		level: string;
		options: Record<string, unknown>;
	}> = [];

	// Console logging - pretty in dev, JSON in production
	if (config.NODE_ENV === "development") {
		targets.push({
			target: "pino-pretty",
			level: config.LOG_LEVEL,
			options: {
				colorize: true,
				translateTime: "SYS:standard",
				ignore: "pid,hostname",
			},
		});
	} else {
		targets.push({
			target: "pino/file",
			level: config.LOG_LEVEL,
			options: { destination: 1 }, // stdout
		});
	}

	// File logging (if configured)
	if (config.LOG_FILE) {
		// Ensure log directory exists
		const logDir = dirname(config.LOG_FILE);
		if (!existsSync(logDir)) {
			try {
				mkdirSync(logDir, { recursive: true });
			} catch (err) {
				console.error(`Failed to create log directory ${logDir}:`, err);
			}
		}

		targets.push({
			target: "pino/file",
			level: config.LOG_FILE_LEVEL || config.LOG_LEVEL,
			options: {
				destination: config.LOG_FILE,
				mkdir: true,
			},
		});
	}

	return {
		level: config.LOG_LEVEL,
		transport: {
			targets,
		},
	} as PinoLoggerOptions;
}
