import { router } from "../trpc.js";
import { deviceRouter } from "./device.js";
import { roborockRouter } from "./roborock.js";
import { ringRouter } from "./ring.js";

export const appRouter = router({
	device: deviceRouter,
	roborock: roborockRouter,
	ring: ringRouter,
});

export type AppRouter = typeof appRouter;
