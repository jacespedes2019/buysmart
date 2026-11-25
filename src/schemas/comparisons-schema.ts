import type { CollectionSchema } from "deepspace/schema";
export const comparisonsSchema: CollectionSchema = {
  name: "comparisons",
  columns: [
    {
      name: "snapshot",
      storage: "text",
      interpretation: { kind: "json" },
      required: true,
    },
  ],
  permissions: {
    "*": { read: false, create: false, update: false, delete: false },
    viewer: { read: "own", create: false, update: false, delete: "own" },
    member: { read: "own", create: false, update: false, delete: "own" },
    admin: { read: "own", create: false, update: false, delete: "own" },
  },
};
