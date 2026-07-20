import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PatternListItem = {
  id: string;
  title: string;
  description: string | null;
  lifecycle: string;
  status: string;
  updatedAt: string;
  acceptedAt: string | null;
};

export const listPatterns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatternListItem[]> => {
    const { data, error } = await context.supabase
      .from("patterns")
      .select("id, title, description, lifecycle, status, updated_at, accepted_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      lifecycle: r.lifecycle,
      status: r.status,
      updatedAt: r.updated_at,
      acceptedAt: r.accepted_at,
    }));
  });

export type PatternEvidenceItem = {
  id: string;
  kind: string;
  excerpt: string | null;
  confidence: number | null;
  createdAt: string;
};

export type PatternPracticeItem = {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  isPrimary: boolean;
};

export type PatternDetail = {
  id: string;
  title: string;
  description: string | null;
  lifecycle: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  acceptanceFeedback: string | null;
  rejectedReason: string | null;
  evidence: PatternEvidenceItem[];
  practices: PatternPracticeItem[];
};

const detailInput = z.object({ patternId: z.string().uuid() });

export const getPatternDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof detailInput>) => detailInput.parse(d))
  .handler(async ({ data, context }): Promise<PatternDetail | null> => {
    const { data: p, error } = await context.supabase
      .from("patterns")
      .select(
        "id, title, description, lifecycle, status, created_at, updated_at, accepted_at, acceptance_feedback, rejected_reason, user_id",
      )
      .eq("id", data.patternId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p || p.user_id !== context.userId) return null;

    const [evRes, prRes] = await Promise.all([
      context.supabase
        .from("pattern_evidence")
        .select("id, kind, excerpt, confidence, created_at")
        .eq("pattern_id", p.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("practices")
        .select("id, kind, title, rationale, is_primary")
        .eq("pattern_id", p.id)
        .eq("user_id", context.userId)
        .order("is_primary", { ascending: false }),
    ]);
    if (evRes.error) throw new Error(evRes.error.message);
    if (prRes.error) throw new Error(prRes.error.message);

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      lifecycle: p.lifecycle,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      acceptedAt: p.accepted_at,
      acceptanceFeedback: p.acceptance_feedback,
      rejectedReason: p.rejected_reason,
      evidence: (evRes.data ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        excerpt: e.excerpt,
        confidence: e.confidence !== null ? Number(e.confidence) : null,
        createdAt: e.created_at,
      })),
      practices: (prRes.data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        rationale: r.rationale,
        isPrimary: r.is_primary,
      })),
    };
  });
