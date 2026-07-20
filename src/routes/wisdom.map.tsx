import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  Scale,
  Send,
  Sparkles,
  ThumbsUp,
  Layers,
  Bot,
  Search,
  Plus,
  Minus,
  Filter,
  ArrowUpDown,
  Share2,
  Image as ImageIcon,
} from "lucide-react";
import {
  ARCHETYPE_INDEX,
  HYPOTHESES,
  PASSAGE_INDEX,
  PERSONA_FACTS,
  PRAYERS,
  seededResponse,
  seededSession,
} from "@/lib/wisdom/mock/seed";

export const Route = createFileRoute("/wisdom/map")({
  head: () => ({ meta: [{ title: "Constellation — Wisdom" }] }),
  component: MapPage,
});

/* ── Domain → categories → nodes ─────────────────────────────── */

type Health = "green" | "amber" | "red";
type LeafNode = {
  id: string;
  label: string;
  gaps: number;
  health: [Health, Health, Health];
  kind: "archetype" | "fact" | "prayer" | "practice";
  refId: string;
};
type Category = {
  id: string;
  label: string;
  icon: typeof Scale;
  count: number;
  nodes: LeafNode[];
};

function healthFor(conf: number): [Health, Health, Health] {
  if (conf >= 0.75) return ["green", "green", "green"];
  if (conf >= 0.55) return ["green", "green", "amber"];
  if (conf >= 0.4) return ["green", "amber", "red"];
  return ["red", "red", "red"];
}

function useGraph() {
  return useMemo(() => {
    const hyps = Object.values(HYPOTHESES);
    const archetypes = Object.values(ARCHETYPE_INDEX);
    const facts = PERSONA_FACTS.filter((f) => f.status !== "rejected" && f.status !== "deleted").slice(0, 12);
    const prayers = Object.values(PRAYERS);

    const patterns: LeafNode[] = hyps.map((h) => ({
      id: `pat_${h.id}`,
      label: h.name,
      gaps: Math.round((1 - h.confidence) * 20),
      health: healthFor(h.confidence),
      kind: "archetype",
      refId: h.archetypes[0]?.archetypeId ?? "archetype_moses_overload",
    }));

    const archetypeNodes: LeafNode[] = archetypes.map((a) => ({
      id: `arch_${a.id}`,
      label: a.person,
      gaps: 4 + Math.floor(Math.random() * 6),
      health: healthFor(0.7),
      kind: "archetype",
      refId: a.id,
    }));

    const factNodes: LeafNode[] = facts.map((f) => ({
      id: `fact_${f.id}`,
      label: f.value,
      gaps: Math.round((1 - f.confidence) * 18),
      health: healthFor(f.confidence),
      kind: "fact",
      refId: f.id,
    }));

    const prayerNodes: LeafNode[] = prayers.map((p) => ({
      id: `pr_${p.id}`,
      label: p.title ?? p.lines[0]?.text.slice(0, 40) ?? "Prayer",
      gaps: 6,
      health: healthFor(0.65),
      kind: "prayer",
      refId: p.id,
    }));

    const categories: Category[] = [
      { id: "services", label: "Patterns", icon: Scale, count: patterns.length, nodes: patterns },
      { id: "entities", label: "Archetypes", icon: Building2, count: archetypeNodes.length, nodes: archetypeNodes },
      { id: "laws", label: "Beliefs", icon: Layers, count: factNodes.length, nodes: factNodes },
      { id: "kpis", label: "Prayers", icon: Activity, count: prayerNodes.length, nodes: prayerNodes },
    ];

    return { categories };
  }, []);
}

/* ── Page ─────────────────────────────────────────────────────── */

function MapPage() {
  const { categories } = useGraph();
  const [activeCat, setActiveCat] = useState(categories[0].id);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(categories[0].nodes[0]?.id ?? null);

  const currentCat = categories.find((c) => c.id === activeCat)!;
  const activeNode =
    currentCat.nodes.find((n) => n.id === activeNodeId) ?? currentCat.nodes[0] ?? null;

  return (
    <div className="fixed inset-0 bg-background text-foreground overflow-hidden">
      <TopBar />

      <div className="absolute inset-0 pt-14 grid grid-cols-[1fr_460px]">
        {/* Graph canvas */}
        <div className="relative overflow-hidden">
          <StarField />
          <GraphCanvas
            categories={categories}
            activeCat={activeCat}
            setActiveCat={(id) => {
              setActiveCat(id);
              const first = categories.find((c) => c.id === id)?.nodes[0]?.id ?? null;
              setActiveNodeId(first);
            }}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
          />
        </div>

        {/* Right rail */}
        <DetailRail node={activeNode} categoryLabel={currentCat.label} />
      </div>

      <ChatDock />
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────── */

function TopBar() {
  return (
    <div className="absolute top-0 left-0 right-0 h-14 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl flex items-center px-4 gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center bg-accent/15 text-accent">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Wisdom</div>
          <div className="text-[10px] text-muted-foreground">Constellation</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-1">
        {[Share2, Plus, Minus, Filter, ArrowUpDown, ImageIcon].map((Icon, i) => (
          <button
            key={i}
            className="w-9 h-9 rounded-md hover:bg-muted/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground font-medium flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New session
        </button>
        <button className="w-9 h-9 rounded-md hover:bg-muted/60 grid place-items-center text-muted-foreground">
          <Search className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Star field backdrop ─────────────────────────────────────── */

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 1.4 + 0.3,
        o: Math.random() * 0.5 + 0.15,
      })),
    [],
  );
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-70">
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.s} fill="white" opacity={s.o} />
      ))}
    </svg>
  );
}

/* ── Graph canvas: orb → categories → node list ──────────────── */

function GraphCanvas({
  categories,
  activeCat,
  setActiveCat,
  activeNodeId,
  setActiveNodeId,
}: {
  categories: Category[];
  activeCat: string;
  setActiveCat: (id: string) => void;
  activeNodeId: string | null;
  setActiveNodeId: (id: string) => void;
}) {
  const current = categories.find((c) => c.id === activeCat)!;

  return (
    <div className="absolute inset-0 grid grid-cols-[280px_240px_1fr] items-center">
      {/* Column 1: orb */}
      <div className="relative h-full flex items-center justify-center">
        <OrbNode label={(seededSession.title ?? "Session").slice(0, 22) + "…"} sub="Session · today" />
      </div>

      {/* Connectors 1 → 2 */}
      <svg className="absolute left-[220px] top-0 h-full w-[120px] pointer-events-none">
        {categories.map((_, i) => {
          const y = 20 + i * 25; // percent
          return (
            <path
              key={i}
              d={`M 0 ${window.innerHeight / 2 - 28} C 60 ${window.innerHeight / 2 - 28}, 60 ${(window.innerHeight * y) / 100}, 120 ${(window.innerHeight * y) / 100}`}
              stroke="hsl(var(--accent) / 0.35)"
              strokeWidth="1"
              fill="none"
            />
          );
        })}
      </svg>

      {/* Column 2: category cards */}
      <div className="flex flex-col gap-3 py-8 pr-2 relative z-10">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            active={cat.id === activeCat}
            onClick={() => setActiveCat(cat.id)}
          />
        ))}
      </div>

      {/* Connectors 2 → 3 */}
      <svg className="absolute left-[520px] top-0 h-full w-[120px] pointer-events-none">
        {current.nodes.map((_, i) => {
          const total = current.nodes.length;
          const startY = window.innerHeight / 2;
          const endY = 90 + (i * (window.innerHeight - 180)) / Math.max(1, total - 1);
          return (
            <path
              key={i}
              d={`M 0 ${startY} C 60 ${startY}, 60 ${endY}, 120 ${endY}`}
              stroke="hsl(var(--accent) / 0.2)"
              strokeWidth="1"
              fill="none"
            />
          );
        })}
      </svg>

      {/* Column 3: scrollable node list */}
      <div className="h-full overflow-y-auto py-6 pl-4 pr-6 relative z-10 [scrollbar-width:thin]">
        <div className="space-y-1.5">
          {current.nodes.map((n) => (
            <NodeRow
              key={n.id}
              node={n}
              active={n.id === activeNodeId}
              onClick={() => setActiveNodeId(n.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Orb ─────────────────────────────────────────────────────── */

function OrbNode({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Orbit rings */}
      <div className="absolute inset-0 -m-16 rounded-full border border-border/30" />
      <div className="absolute inset-0 -m-28 rounded-full border border-border/20" />

      <div className="text-center mb-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>

      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/30 via-primary/20 to-transparent blur-2xl" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 via-accent/40 to-primary/60 shadow-[0_0_60px_rgba(163,230,53,0.35)] backdrop-blur-sm border border-white/10" />
        <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-white/40 to-transparent opacity-60" />
        <div className="absolute -inset-4 rounded-full border border-accent/20 animate-pulse" />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="text-muted-foreground/60">GAPS</span>
        <span>12</span>
        <ThumbsUp className="w-3 h-3 ml-1" />
        <HealthPips values={["green", "amber", "red"]} />
      </div>
    </div>
  );
}

/* ── Category card ───────────────────────────────────────────── */

function CategoryCard({
  cat,
  active,
  onClick,
}: {
  cat: Category;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      className={`group relative text-left rounded-xl border transition-all ${
        active
          ? "border-accent/60 bg-accent/[0.06] shadow-[0_0_0_1px_hsl(var(--accent)/0.4),0_8px_24px_-12px_hsl(var(--accent)/0.5)]"
          : "border-border/50 bg-card/40 hover:border-border hover:bg-card/70"
      } backdrop-blur-md px-4 py-3 flex items-center gap-3`}
    >
      <div
        className={`w-8 h-8 rounded-md grid place-items-center ${
          active ? "bg-accent/20 text-accent" : "bg-muted/60 text-muted-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold leading-none">{cat.count}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{cat.label}</div>
      </div>
      {active && <ChevronRight className="w-4 h-4 text-accent" />}
    </button>
  );
}

/* ── Node row ────────────────────────────────────────────────── */

function NodeRow({
  node,
  active,
  onClick,
}: {
  node: LeafNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md px-3 py-2 border transition-colors ${
        active
          ? "border-accent/50 bg-accent/[0.05]"
          : "border-transparent hover:border-border/50 hover:bg-muted/30"
      }`}
    >
      <div className="text-[13px] text-foreground truncate">{node.label}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="text-muted-foreground/60">GAPS</span>
        <span>{node.gaps}</span>
        <ThumbsUp className="w-3 h-3 ml-0.5" />
        <HealthPips values={node.health} />
      </div>
    </button>
  );
}

function HealthPips({ values }: { values: [Health, Health, Health] }) {
  const map: Record<Health, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-400",
    red: "bg-red-500",
  };
  return (
    <div className="flex gap-0.5 ml-1">
      {values.map((v, i) => (
        <span key={i} className={`w-3 h-2 rounded-[2px] ${map[v]}`} />
      ))}
    </div>
  );
}

/* ── Right detail rail ───────────────────────────────────────── */

function DetailRail({
  node,
  categoryLabel,
}: {
  node: LeafNode | null;
  categoryLabel: string;
}) {
  if (!node) {
    return (
      <div className="border-l border-border/40 bg-card/30 backdrop-blur-xl p-6 text-sm text-muted-foreground">
        Select a node.
      </div>
    );
  }

  const detail = resolveDetail(node);
  const scores = detail.scores;

  return (
    <aside className="border-l border-border/40 bg-card/40 backdrop-blur-xl overflow-y-auto">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            <span>{categoryLabel}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
            Active
          </span>
        </div>

        <h2 className="text-xl font-semibold leading-snug">{detail.title}</h2>

        <div className="rounded-lg border border-border/40 bg-background/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Last updated on{" "}
              <span className="text-foreground">Jul 20, 2026</span>
            </span>
            <button className="text-[10px] text-accent flex items-center gap-1">
              Explore details <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {detail.summary}
          </p>
        </div>

        <div className="rounded-lg border border-border/40 bg-background/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <span className="text-[10px] text-muted-foreground">
              {scores.label}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-semibold tracking-tight">
              {scores.percent}%
            </div>
            <div className="text-[11px] text-red-400 mb-1.5">
              {scores.delta} last cycle
            </div>
            <div className="ml-auto flex items-end gap-0.5 h-10">
              {Array.from({ length: 32 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1 bg-accent/40 rounded-sm"
                  style={{ height: `${20 + Math.random() * 80}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {detail.metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="rounded-lg border border-border/40 bg-background/50 p-3"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="text-xl font-semibold mt-2">{m.value}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-accent">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wisdom analysis</span>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/50 p-4 space-y-2">
            <div className="text-sm font-medium">{detail.recommendation.title}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {detail.recommendation.body}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function resolveDetail(node: LeafNode) {
  if (node.kind === "archetype") {
    const a = ARCHETYPE_INDEX[node.refId];
    const passage = a ? PASSAGE_INDEX[a.passageRefs[0]] : undefined;
    return {
      title: a ? `${a.person} — ${a.title}` : node.label,
      summary:
        passage?.curatorSummary ??
        "A biblical mirror surfaced from your pattern graph. Names the shape, not the person.",
      scores: { percent: 72, delta: "-4%", label: "Moderate" },
      metrics: [
        { label: "Passages", value: a?.passageRefs.length ?? 0, icon: Layers },
        { label: "Related patterns", value: 3, icon: Scale },
        { label: "Prayers linked", value: 2, icon: Sparkles },
        { label: "Practices", value: 4, icon: Activity },
      ],
      recommendation: {
        title: "Sit with the mirror",
        body:
          "Read the passage slowly. Ask where the archetype's tension lives in your week — not to imitate, but to notice.",
      },
    };
  }
  if (node.kind === "fact") {
    const f = PERSONA_FACTS.find((x) => x.id === node.refId);
    return {
      title: f?.summary ?? node.label,
      summary:
        "A remembered belief in your persona graph. Editable, contestable, always yours to revise.",
      scores: {
        percent: Math.round((f?.confidence ?? 0.6) * 100),
        delta: "+2%",
        label: (f?.confidence ?? 0.6) > 0.7 ? "Strong" : "Moderate",
      },
      metrics: [
        { label: "Sources", value: f?.sourceMessageIds.length ?? 1, icon: Layers },
        { label: "Sensitivity", value: f?.sensitivity ?? "std", icon: Scale },
        { label: "Directive", value: f?.remember ? "Keep" : "DNR", icon: Sparkles },
        { label: "Related", value: 2, icon: Activity },
      ],
      recommendation: {
        title: "Test the belief",
        body:
          "Write one sentence you'd tell a friend who held this belief. Does the compassion match what you offer yourself?",
      },
    };
  }
  if (node.kind === "prayer") {
    const p = PRAYERS[node.refId];
    return {
      title: p?.title ?? node.label,
      summary:
        p?.movements.map((m) => m.text).join(" ").slice(0, 220) ??
        "A prayer scaffold rooted in Scripture. Not a script — a starting point.",
      scores: { percent: 65, delta: "0%", label: "Steady" },
      metrics: [
        { label: "Movements", value: p?.movements.length ?? 3, icon: Layers },
        { label: "Sources", value: p?.movements[0]?.sourceIds.length ?? 1, icon: Scale },
        { label: "Tier", value: "S1", icon: Sparkles },
        { label: "Used", value: 1, icon: Activity },
      ],
      recommendation: {
        title: "Pray slowly",
        body:
          "Read one movement, pause, breathe. If a phrase catches, stay there. The scaffold serves you, not the other way.",
      },
    };
  }
  return {
    title: node.label,
    summary: "Detail unavailable.",
    scores: { percent: 50, delta: "0%", label: "—" },
    metrics: [],
    recommendation: { title: "", body: "" },
  };
}

/* ── Ambient chat dock ───────────────────────────────────────── */

function ChatDock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-[476px] z-40">
      {open && (
        <div className="mb-2 w-[360px] rounded-xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent/15 grid place-items-center">
              <Bot className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="text-sm font-medium">Wisdom agent</div>
          </div>
          <div className="p-4 text-xs text-muted-foreground min-h-[120px]">
            Ask about any node — a pattern, an archetype, a prayer. I'll ground the answer
            in your graph and Scripture.
          </div>
          <div className="p-2 border-t border-border/40 flex items-center gap-2">
            <input
              className="flex-1 bg-transparent text-xs px-2 py-1.5 outline-none placeholder:text-muted-foreground/60"
              placeholder="Ask a question..."
            />
            <button className="w-8 h-8 rounded-md bg-accent text-accent-foreground grid place-items-center">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-card/90 backdrop-blur-xl shadow-lg text-xs hover:border-accent/50 transition-colors"
      >
        <div className="w-5 h-5 rounded-full bg-accent/15 grid place-items-center">
          <Bot className="w-3 h-3 text-accent" />
        </div>
        <span>My agent</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
    </div>
  );
}

/* seededResponse kept as intentional named-import reference for future connect */
void seededResponse;
