import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConstellationNode = {
  id: string;
  refId: string;
  label: string;
};

export type ConstellationCategory = {
  id: "patterns" | "beliefs" | "prayers" | "archetypes";
  label: string;
  nodes: ConstellationNode[];
};

export type Constellation = {
  categories: ConstellationCategory[];
};

export const getConstellation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Constellation> => {
    const { supabase, userId } = context;
    const [patternsRes, factsRes, prayersRes, archetypeRes] = await Promise.all([
      supabase
        .from("patterns")
        .select("id, title, lifecycle, status")
        .eq("user_id", userId)
        .neq("status", "archived")
        .neq("lifecycle", "rejected")
        .order("updated_at", { ascending: false })
        .limit(48),
      supabase
        .from("persona_facts")
        .select("id, key, value, status")
        .eq("user_id", userId)
        .in("status", ["accepted", "proposed", "corrected"])
        .order("updated_at", { ascending: false })
        .limit(48),
      supabase
        .from("prayers")
        .select("id, title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(48),
      supabase
        .from("interpretations")
        .select("archetype_id, biblical_archetypes(id, title)")
        .eq("user_id", userId)
        .not("archetype_id", "is", null)
        .limit(48),
    ]);
    if (patternsRes.error) throw new Error(patternsRes.error.message);
    if (factsRes.error) throw new Error(factsRes.error.message);
    if (prayersRes.error) throw new Error(prayersRes.error.message);
    if (archetypeRes.error) throw new Error(archetypeRes.error.message);

    const patternNodes: ConstellationNode[] = (patternsRes.data ?? []).map((p) => ({
      id: `pat_${p.id}`,
      refId: p.id,
      label: p.title,
    }));

    const factNodes: ConstellationNode[] = (factsRes.data ?? []).map((f) => {
      const v = f.value as unknown;
      const label =
        typeof v === "string"
          ? v
          : v && typeof v === "object" && "value" in (v as Record<string, unknown>)
            ? String((v as Record<string, unknown>).value)
            : f.key;
      return { id: `fact_${f.id}`, refId: f.id, label };
    });

    const prayerNodes: ConstellationNode[] = (prayersRes.data ?? []).map((p) => ({
      id: `pr_${p.id}`,
      refId: p.id,
      label: p.title,
    }));

    const seen = new Set<string>();
    const archetypeNodes: ConstellationNode[] = [];
    for (const row of archetypeRes.data ?? []) {
      const arch = row.biblical_archetypes as unknown as { id: string; title: string } | null;
      if (!arch || seen.has(arch.id)) continue;
      seen.add(arch.id);
      archetypeNodes.push({ id: `arch_${arch.id}`, refId: arch.id, label: arch.title });
    }

    return {
      categories: [
        { id: "patterns", label: "Patterns", nodes: patternNodes },
        { id: "archetypes", label: "Archetypes", nodes: archetypeNodes },
        { id: "beliefs", label: "Beliefs", nodes: factNodes },
        { id: "prayers", label: "Prayers", nodes: prayerNodes },
      ],
    };
  });
