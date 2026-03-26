import type { ReplyPublic } from "@/types/replies";

export type ReplyNode = ReplyPublic & { children: ReplyNode[] };

export function buildReplyTree(flat: ReplyPublic[]): ReplyNode[] {
  const map = new Map<string, ReplyNode>();
  for (const r of flat) {
    map.set(r.id, { ...r, children: [] });
  }
  const roots: ReplyNode[] = [];

  for (const r of flat) {
    const node = map.get(r.id)!;
    if (r.parent_reply_id) {
      const parent = map.get(r.parent_reply_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (n: ReplyNode) => {
    n.children.sort((a, b) => a.created_at.localeCompare(b.created_at));
    n.children.forEach(sortRecursive);
  };
  roots.sort((a, b) => a.created_at.localeCompare(b.created_at));
  roots.forEach(sortRecursive);
  return roots;
}
