/**
 * Mirrors — surfaces the biblical archetypes the user has encountered
 * (via prayers cited from archetype-linked passages) plus the full
 * curated catalog of approved archetypes.
 *
 * All reads are RLS-scoped to the caller.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ArchetypeMirror = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  encounters: number;
  lastEncounteredAt: string | null;
  mirrors: { id: string; mirrorType: string; description: string }[];
  passages: { id: string; reference: string; text: string }[];
};

export type MirrorsResult = {
  encountered: ArchetypeMirror[];
  catalog: ArchetypeMirror[];
};

export const listArchetypeMirrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MirrorsResult> => {
    const s = context.supabase;

    // 1. Full approved catalog with mirrors + passages.
    const { data: archetypes, error: aErr } = await s
      .from("biblical_archetypes")
      .select(`
        id, slug, title, summary,
        archetype_mirrors ( id, mirror_type, description ),
        archetype_passages (
          passage_id,
          source_passages ( id, reference, text )
        )
      `)
      .eq("status", "approved")
      .order("title", { ascending: true });
    if (aErr) throw new Error(aErr.message);

    // 2. Encounters: user's prayer_line_sources → source_passages.id → archetype_passages.
    const { data: sources } = await s
      .from("prayer_line_sources")
      .select("passage_id, created_at")
      .eq("user_id", context.userId);

    const encounterByArch = new Map<string, { count: number; lastAt: string | null }>();
    if (sources?.length) {
      const passageIds = Array.from(new Set(sources.map((r) => r.passage_id)));
      const { data: links } = await s
        .from("archetype_passages")
        .select("archetype_id, passage_id")
        .in("passage_id", passageIds);
      if (links?.length) {
        const passageToArch = new Map<string, string[]>();
        for (const l of links) {
          const arr = passageToArch.get(l.passage_id) ?? [];
          arr.push(l.archetype_id);
          passageToArch.set(l.passage_id, arr);
        }
        for (const src of sources) {
          const archIds = passageToArch.get(src.passage_id) ?? [];
          for (const aid of archIds) {
            const cur = encounterByArch.get(aid) ?? { count: 0, lastAt: null };
            cur.count += 1;
            if (!cur.lastAt || src.created_at > cur.lastAt) cur.lastAt = src.created_at;
            encounterByArch.set(aid, cur);
          }
        }
      }
    }

    const shape = (a: NonNullable<typeof archetypes>[number]): ArchetypeMirror => {
      const enc = encounterByArch.get(a.id);
      const mirrors = (a.archetype_mirrors ?? []).map((m) => ({
        id: m.id,
        mirrorType: m.mirror_type,
        description: m.description,
      }));
      const passages = (a.archetype_passages ?? [])
        .map((ap) => {
          const p = ap.source_passages as unknown as
            | { id: string; reference: string; text: string }
            | null;
          return p ? { id: p.id, reference: p.reference, text: p.text } : null;
        })
        .filter((p): p is { id: string; reference: string; text: string } => !!p);
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        encounters: enc?.count ?? 0,
        lastEncounteredAt: enc?.lastAt ?? null,
        mirrors,
        passages,
      };
    };

    const all = (archetypes ?? []).map(shape);
    const encountered = all
      .filter((a) => a.encounters > 0)
      .sort((a, b) => (b.lastEncounteredAt ?? "").localeCompare(a.lastEncounteredAt ?? ""));
    return { encountered, catalog: all };
  });
