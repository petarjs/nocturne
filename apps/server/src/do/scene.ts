import { DurableObject } from "cloudflare:workers";

/** One DO per dashboard. Scene state, op log, and live WebSockets land here next. */
export class SceneDO extends DurableObject<Env> {}
