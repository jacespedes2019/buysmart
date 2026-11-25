import type { CollectionSchema } from "deepspace/schema";
export const priceWatchesSchema: CollectionSchema = {
  name: "priceWatches",
  columns: [
    { name: "config", storage: "text", interpretation: { kind: "json" }, required: true },
    { name: "report", storage: "text", interpretation: { kind: "json" } },
  ],
  permissions: {
    "*": { read: false, create: false, update: false, delete: false },
    viewer: { read: "own", create: false, update: false, delete: "own" },
    member: { read: "own", create: false, update: false, delete: "own" },
    admin: { read: "own", create: false, update: false, delete: "own" },
  },
};
