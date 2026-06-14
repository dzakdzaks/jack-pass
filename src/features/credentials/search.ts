// Local search/filter over decrypted credentials (PRD 10). Runs in-memory only.

import type { CredentialItem } from "@/lib/types";

export interface CredentialFilter {
  query: string;
  tag: string | null;
  favoritesOnly: boolean;
}

export function filterCredentials(
  items: CredentialItem[],
  filter: CredentialFilter,
): CredentialItem[] {
  const q = filter.query.trim().toLowerCase();
  return items
    .filter((item) => {
      if (filter.favoritesOnly && !item.favorite) return false;
      if (filter.tag && !item.tags.includes(filter.tag)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
}

export function allTags(items: CredentialItem[]): string[] {
  const set = new Set<string>();
  items.forEach((item) => item.tags.forEach((t) => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b));
}
