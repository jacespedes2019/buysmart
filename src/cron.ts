import { buildCronContext, type CronTask } from "deepspace/worker";
import type { Env } from "../worker";
import { runPriceChecks } from "./prices/runner";
// Alarm wakes periodically to resume existing asynchronous jobs. New paid checks are
// admitted at most once per ASIN per 24h, and only after an owner explicitly enables spending.
export const tasks: CronTask[] = [{ name: "price-watch", intervalMinutes: 15 }];
export async function runTask(name: string, env: Env): Promise<void> {
  if (name === "price-watch") await runPriceChecks(env, buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`));
}
