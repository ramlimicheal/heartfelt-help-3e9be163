import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NodeHealth = "green" | "amber" | "red";

export type ConstellationNode = {
  id: string;
  refId: string;
  label: string;
  health: NodeHealth;
  score: number; // 0..1
  note: string;
};

export type ConstellationCategory = {
  id: "patterns" | "beliefs" | "prayers" | "archetypes";
  label: string;
  nodes: ConstellationNode[];
};

export type Constellation = {
  categories: ConstellationCategory[];
};

const DAY = 24 * 60 * 60 * 1000;

function recencyBucket(iso: string | null): number {
  if (!iso) return 0;
  const age = Date.now() - new Date(iso).getTime();
  if (age < 7 * DAY) return 1;
  if (age < 30 * DAY) return 0.6;
  if (age < 90 * DAY) return 0.3;
  return 0.1;
}

export const getConstellation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Constellation> => {
    const { supabase, userId } = context;
    const [patternsRes, factsRes, prayersRes, archetypeRes] = await Promise.all([
      supabase
        .from("patterns")
        .select("id, title, lifecycle, status, updated_at, pattern_evidence(count)")
        .eq("user_id", userId)
        .neq("status", "archived")
        .neq("lifecycle", "rejected")
        .order("updated_at", { ascending: false })
        .limit(48),
      supabase
        .from("persona_facts")
        .select("id, key, value, status, confidence, updated_at")
        .eq("user_id", userId)
        .in("status", ["accepted", "proposed", "corrected"])
        .order("updated_at", { ascending: false })
        .limit(48),
      supabase
        .from("prayers")
        .select("id, title, finalized_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(48),
      supabase
        .from("interpretations")
        .select("archetype_id, created_at, biblical_archetypes(id, title)")
        .eq("user_id", userId)
        .not("archetype_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(48),
    ]);
    if (patternsRes.error) throw new Error(patternsRes.error.message);
    if (factsRes.error) throw new Error(factsRes.error.message);
    if (prayersRes.error) throw new Error(prayersRes.error.message);
    if (archetypeRes.error) throw new Error(archetypeRes.error.message);

    const patternNodes: ConstellationNode[] = (patternsRes.data ?? []).map((p) => {
      const evidenceAgg = p.pattern_evidence as unknown as { count: number }[] | null;
      const evCount = evidenceAgg?.[0]?.count ?? 0;
      const recency = recencyBucket(p.updated_at);
      let score = 0;
      let health: NodeHealth = "red";
      let note = "";
      if (p.lifecycle === "accepted") {
        score = Math.min(1, 0.7 + evCount * 0.05) * (0.6 + recency * 0.4);
        health = score >= 0.7 ? "green" : score >= 0.4 ? "amber" : "red";
        note = `accepted · ${evCount} evidence`;
      } else if (p.lifecycle === "reconsidered") {
        score = 0.5 * recency;
        health = "amber";
        note = `reconsidered · ${evCount} evidence`;
      } else {
        // pending / proposed
        score = Math.min(0.6, 0.25 + evCount * 0.08) * (0.5 + recency * 0.5);
        health = evCount >= 3 ? "amber" : "red";
        note = `pending · ${evCount} evidence`;
      }
      return { id: `pat_${p.id}`, refId: p.id, label: p.title, health, score, note };
    });

    const factNodes: ConstellationNode[] = (factsRes.data ?? []).map((f) => {
      const v = f.value as unknown;
      const label =
        typeof v === "string"
          ? v
          : v && typeof v === "object" && "value" in (v as Record<string, unknown>)
            ? String((v as Record<string, unknown>).value)
            : f.key;
      const conf = Number(f.confidence ?? 0);
      let health: NodeHealth = "amber";
      let note = f.status;
      if (f.status === "accepted") { health = "green"; note = "you confirmed this"; }
      else if (f.status === "corrected") { health = "amber"; note = "you refined this"; }
      else { health = "amber"; note = "proposed — awaits your review"; }
      const score = f.status === "accepted" ? Math.max(0.7, conf) : Math.min(0.6, Math.max(0.3, conf));
      return { id: `fact_${f.id}`, refId: f.id, label, health, score, note };
    });

    const prayerNodes: ConstellationNode[] = (prayersRes.data ?? []).map((p) => {
      const finalized = Boolean(p.finalized_at);
      const recency = recencyBucket(p.finalized_at ?? p.created_at);
      let health: NodeHealth = "red";
      let note = "";
      let score = 0;
      if (finalized && recency >= 0.6) { health = "green"; score = 0.85; note = "prayed recently"; }
      else if (finalized) { health = "amber"; score = 0.55; note = "prayed"; }
      else { health = "red"; score = 0.2; note = "draft"; }
      return { id: `pr_${p.id}`, refId: p.id, label: p.title, health, score, note };
    });

    const seen = new Set<string>();
    const cited: Array<{ id: string; title: string; created: string }> = [];
    for (const row of archetypeRes.data ?? []) {
      const arch = row.biblical_archetypes as unknown as { id: string; title: string } | null;
      if (!arch || seen.has(arch.id)) continue;
      seen.add(arch.id);
      cited.push({ id: arch.id, title: arch.title, created: row.created_at });
    }
    const archetypeNodes: ConstellationNode[] = cited.map((a) => {
      const recency = recencyBucket(a.created);
      const health: NodeHealth = recency >= 0.6 ? "green" : "amber";
      return {
        id: `arch_${a.id}`, refId: a.id, label: a.title,
        health, score: 0.5 + recency * 0.4, note: "cited by Wisdom",
      };
    });

    return {
      categories: [
        { id: "patterns", label: "Patterns", nodes: patternNodes },
        { id: "archetypes", label: "Archetypes", nodes: archetypeNodes },
        { id: "beliefs", label: "Beliefs", nodes: factNodes },
        { id: "prayers", label: "Prayers", nodes: prayerNodes },
      ],
    };
  });
