import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flame, HandHelping, Heart, Sparkles, User } from "lucide-react";
import {
  ARCHETYPE_INDEX,
  HYPOTHESES,
  PASSAGE_INDEX,
  PERSONA_FACTS,
  PRAYERS,
  seededResponse,
} from "@/lib/wisdom/mock/seed";
import { Card, MovementBadge, TierChip } from "@/components/wisdom/primitives";
import type { PatternHypothesis } from "@/lib/wisdom/schemas";

export const Route = createFileRoute("/wisdom/map")({
  head: () => ({ meta: [{ title: "Your constellation — Wisdom" }] }),
  component: MapPage,
});

/* ── Geometry ─────────────────────────────────────────────────────── */

const VIEW = 900;
const CENTER = VIEW / 2;
const R_PATTERN = 190;
const R_SATELLITE = 330;

type NodeKind = "self" | "pattern" | "archetype" | "person" | "fact" | "prayer";
type Node = {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
  x: number;
  y: number;
  parentId?: string;
  meta?: Record<string, unknown>;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/* ── Page ─────────────────────────────────────────────────────────── */

function MapPage() {
  const patterns = useMemo(
    () => Object.values(HYPOTHESES).sort((a, b) => b.confidence - a.confidence),
    [],
  );

  const { nodes, edges } = useMemo(() => buildGraph(patterns), [patterns]);
  const [selectedId, setSelectedId] = useState<string>(nodes[0].id);
  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Constellation
        </p>
        <h1 className="font-serif text-3xl leading-tight">Your patterns, as a living map.</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          The center is you. The inner ring holds the patterns Wisdom has proposed. The outer ring
          holds the biblical archetypes, people and beliefs anchored to each pattern. Select a node
          to open its interpretation, prayer, and one next act.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Graph */}
        <div className="relative overflow-hidden rounded-3xl border border-panel-border bg-gradient-to-b from-surface/40 via-background to-background">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Pattern constellation"
          >
            <defs>
              <radialGradient id="haloCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="haloRing" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* orbit guides */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_PATTERN}
              fill="none"
              stroke="hsl(var(--panel-border))"
              strokeDasharray="2 6"
              strokeOpacity="0.6"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_SATELLITE}
              fill="none"
              stroke="hsl(var(--panel-border))"
              strokeDasharray="2 6"
              strokeOpacity="0.4"
            />

            {/* halos */}
            <circle cx={CENTER} cy={CENTER} r={210} fill="url(#haloCore)" />
            <circle cx={CENTER} cy={CENTER} r={360} fill="url(#haloRing)" />

            {/* edges */}
            {edges.map((e, i) => {
              const a = nodes.find((n) => n.id === e.from)!;
              const b = nodes.find((n) => n.id === e.to)!;
              const active = selectedId === e.from || selectedId === e.to;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={active ? 0.55 : 0.14}
                  strokeWidth={active ? 1.4 : 0.8}
                />
              );
            })}

            {/* nodes */}
            {nodes.map((n) => (
              <NodeMark
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                onSelect={() => setSelectedId(n.id)}
              />
            ))}
          </svg>

          {/* Legend */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-full border border-panel-border/60 bg-background/70 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
            <LegendDot color="hsl(var(--primary))" label="You" />
            <LegendDot color="#e4b34a" label="Pattern" />
            <LegendDot color="#8bb4ff" label="Archetype" />
            <LegendDot color="#c78bff" label="Person / belief" />
          </div>
        </div>

        {/* Right rail */}
        <aside className="min-w-0 space-y-4">
          <DetailPanel node={selected} />
        </aside>
      </div>
    </div>
  );
}

/* ── Graph builder ───────────────────────────────────────────────── */

function buildGraph(patterns: PatternHypothesis[]) {
  const nodes: Node[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  nodes.push({
    id: "self",
    kind: "self",
    label: "You",
    sub: "Present moment",
    x: CENTER,
    y: CENTER,
  });

  const n = patterns.length;
  patterns.forEach((p, i) => {
    const angle = (360 / n) * i + 12;
    const pos = polar(CENTER, CENTER, R_PATTERN, angle);
    nodes.push({
      id: p.id,
      kind: "pattern",
      label: p.name,
      sub: `${Math.round(p.confidence * 100)}% confidence`,
      x: pos.x,
      y: pos.y,
      parentId: "self",
      meta: { pattern: p },
    });
    edges.push({ from: "self", to: p.id });

    // satellites: archetypes for this pattern + a persona fact or two
    const sats = p.archetypes.slice(0, 3);
    const facts = i === 0 ? PERSONA_FACTS.slice(0, 2) : [];
    const total = sats.length + facts.length;
    const span = 55; // degrees around the pattern
    const start = angle - span / 2;
    const step = total > 1 ? span / (total - 1) : 0;

    sats.forEach((s, k) => {
      const a = ARCHETYPE_INDEX[s.archetypeId];
      if (!a) return;
      const satAngle = start + step * k;
      const sp = polar(CENTER, CENTER, R_SATELLITE, satAngle);
      const id = `${p.id}__${a.id}`;
      nodes.push({
        id,
        kind: "archetype",
        label: a.person,
        sub: a.headline,
        x: sp.x,
        y: sp.y,
        parentId: p.id,
        meta: { archetype: a, link: s },
      });
      edges.push({ from: p.id, to: id });
    });

    facts.forEach((f, k) => {
      const satAngle = start + step * (sats.length + k);
      const sp = polar(CENTER, CENTER, R_SATELLITE, satAngle);
      const id = `${p.id}__${f.id}`;
      nodes.push({
        id,
        kind: "fact",
        label: f.key.replace(/_/g, " "),
        sub: f.value,
        x: sp.x,
        y: sp.y,
        parentId: p.id,
        meta: { fact: f },
      });
      edges.push({ from: p.id, to: id });
    });
  });

  return { nodes, edges };
}

/* ── Node mark ────────────────────────────────────────────────────── */

function NodeMark({
  node,
  selected,
  onSelect,
}: {
  node: Node;
  selected: boolean;
  onSelect: () => void;
}) {
  const styles: Record<NodeKind, { fill: string; ring: string; r: number; text: string }> = {
    self: { fill: "hsl(var(--primary))", ring: "hsl(var(--primary))", r: 34, text: "hsl(var(--primary-foreground))" },
    pattern: { fill: "#2a2415", ring: "#e4b34a", r: 22, text: "#f5e5b8" },
    archetype: { fill: "#141c2e", ring: "#8bb4ff", r: 16, text: "#cfe0ff" },
    person: { fill: "#1b1428", ring: "#c78bff", r: 14, text: "#e6d1ff" },
    fact: { fill: "#1b1428", ring: "#c78bff", r: 14, text: "#e6d1ff" },
    prayer: { fill: "#0f1f18", ring: "#7ed9a8", r: 14, text: "#c9f0dc" },
  };
  const s = styles[node.kind];
  const isSelf = node.kind === "self";
  const labelY = node.y + s.r + 16;

  return (
    <g
      onClick={onSelect}
      className="cursor-pointer"
      style={{ transition: "transform 200ms" }}
    >
      {selected && (
        <circle
          cx={node.x}
          cy={node.y}
          r={s.r + 10}
          fill="none"
          stroke={s.ring}
          strokeOpacity="0.5"
          strokeWidth="1.2"
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={s.r}
        fill={s.fill}
        stroke={s.ring}
        strokeWidth={selected ? 2 : 1.2}
        style={{
          filter: selected || isSelf ? `drop-shadow(0 0 12px ${s.ring})` : undefined,
        }}
      />
      {isSelf && (
        <text
          x={node.x}
          y={node.y + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight={600}
          fill={s.text}
        >
          You
        </text>
      )}
      <text
        x={node.x}
        y={labelY}
        textAnchor="middle"
        fontSize={node.kind === "pattern" ? 13 : 11}
        fill="hsl(var(--foreground))"
        fillOpacity={selected ? 1 : 0.75}
        style={{ pointerEvents: "none" }}
      >
        {truncate(node.label, node.kind === "pattern" ? 28 : 22)}
      </text>
    </g>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  );
}

/* ── Detail panel ─────────────────────────────────────────────────── */

function DetailPanel({ node }: { node: Node }) {
  if (node.kind === "self") {
    return (
      <Card eyebrow="Interpretation" title="What Wisdom hears right now">
        <p>{seededResponse.whatIHear}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
          Select a pattern in the constellation to open its prayer and next act.
        </p>
      </Card>
    );
  }

  if (node.kind === "pattern") {
    const p = node.meta?.pattern as PatternHypothesis;
    const prayer = Object.values(PRAYERS).find((pr) => pr.patternId === p.id);
    return (
      <>
        <Card
          eyebrow="Pattern"
          title={p.name}
          aside={
            <span className="rounded-full border border-panel-border/60 bg-surface/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {Math.round(p.confidence * 100)}%
            </span>
          }
        >
          <p>{p.description}</p>
          <div className="mt-4 rounded-lg border border-panel-border/60 bg-background/40 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
              Hidden agreement to test
            </p>
            <p className="mt-1 font-serif italic text-foreground/90">
              “{p.hiddenAgreementCandidate}”
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Distinguishing question · {p.distinguishingQuestion}
          </p>
        </Card>

        {prayer && (
          <Card eyebrow="Prayer" title={prayer.title}>
            <ul className="space-y-3">
              {prayer.lines.slice(0, 3).map((ln) => (
                <li key={ln.id} className="space-y-1.5">
                  <MovementBadge movement={ln.movement} />
                  <p className="font-serif text-[15px] leading-relaxed text-foreground/95">
                    {ln.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ln.sources.map((src, i) => {
                      const pass = PASSAGE_INDEX[src.passageId];
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full border border-panel-border/60 bg-surface/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <TierChip tier={src.tier} />
                          {pass?.reference}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );
  }

  if (node.kind === "archetype") {
    const a = node.meta?.archetype as (typeof ARCHETYPE_INDEX)[string];
    const link = node.meta?.link as { whyThisConnection: string; fitScore: number };
    return (
      <Card
        eyebrow="Discernment"
        title={a.person}
        aside={
          <span className="rounded-full border border-panel-border/60 bg-surface/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            fit {Math.round(link.fitScore * 100)}%
          </span>
        }
      >
        <p className="text-sm font-medium text-primary">{a.headline}</p>
        <p className="mt-2">{a.narrativeSummary}</p>
        <div className="mt-3 rounded-lg border border-panel-border/60 bg-background/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            Why this connection
          </p>
          <p className="mt-1 text-sm text-foreground/90">{link.whyThisConnection}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.primaryPassages.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border border-panel-border/60 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <TierChip tier={p.tier} />
              {p.reference}
            </span>
          ))}
        </div>
      </Card>
    );
  }

  if (node.kind === "fact") {
    const f = node.meta?.fact as (typeof PERSONA_FACTS)[number];
    return (
      <Card eyebrow="Pattern" title={f.key.replace(/_/g, " ")}>
        <p>{f.value}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
          {f.domain} · {f.sensitivity} · {Math.round(f.confidence * 100)}%
        </p>
      </Card>
    );
  }

  return null;
}
