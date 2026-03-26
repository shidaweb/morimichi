import { createHmac } from "node:crypto";

export function hashIpForView(ip: string): string {
  const salt =
    process.env.VIEW_HASH_SALT ?? "development-view-salt-change-in-production";
  return createHmac("sha256", salt).update(ip).digest("hex");
}
