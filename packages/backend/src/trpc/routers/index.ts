import { router } from "../trpc.js";
import { deviceRouter } from "./device.js";
import { ringRouter } from "./ring.js";
import { roborockRouter } from "./roborock.js";

export const appRouter = router({
	device: deviceRouter,
	roborock: roborockRouter,
	ring: ringRouter,
});

export type AppRouter = typeof appRouter;
