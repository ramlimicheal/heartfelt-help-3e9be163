import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  Scale,
  Send,
  Sparkles,
  Layers,
  Bot,
  Search,
  Plus,
  Minus,
  Filter,
  ArrowUpDown,
  Share2,
  Image as ImageIcon,
  Menu,
  X,
  Check,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConstellation, type ConstellationCategory } from "@/lib/wisdom/constellation.functions";

export const Route = createFileRoute("/wisdom/map")({
  head: () => ({ meta: [{ title: "Constellation — Wisdom" }] }),
  component: MapPage,
});


/* ── Palette (restrained, monochrome + teal + gold) ─────────────── */
const TEAL = "rgba(120, 220, 210, 1)";
const TEAL_SOFT = "rgba(120, 220, 210, 0.35)";
const TEAL_DIM = "rgba(120, 220, 210, 0.12)";
const GOLD = "rgba(230, 190, 120, 1)";
const GOLD_SOFT = "rgba(230, 190, 120, 0.35)";
const DIM = "rgba(180, 220, 210, 0.18)";

/* ── Types ───────────────────────────────────────────────────── */

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

function healthFor(_conf: number): [Health, Health, Health] {
  // Health signal isn't backed by real data yet — render a neutral triple.
  return ["green", "green", "green"];
}

const ICONS: Record<ConstellationCategory["id"], typeof Scale> = {
  patterns: Scale,
  archetypes: Building2,
  beliefs: Layers,
  prayers: Activity,
};

const KINDS: Record<ConstellationCategory["id"], LeafNode["kind"]> = {
  patterns: "archetype",
  archetypes: "archetype",
  beliefs: "fact",
  prayers: "prayer",
};

function useGraph() {
  const fn = useServerFn(getConstellation);
  const { data } = useQuery({ queryKey: ["constellation"], queryFn: () => fn() });
  return useMemo<{ categories: Category[] }>(() => {
    const src = data?.categories ?? [];
    const categories: Category[] = src.map((c) => {
      const nodes: LeafNode[] = c.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        gaps: 0,
        health: healthFor(0.65),
        kind: KINDS[c.id],
        refId: n.refId,
      }));
      return {
        id: c.id,
        label: c.label,
        icon: ICONS[c.id],
        count: nodes.length,
        nodes,
      };
    });
    if (categories.length === 0) {
      // Preserve category slots so the UI shell renders while empty.
      return {
        categories: (["patterns", "archetypes", "beliefs", "prayers"] as const).map((id) => ({
          id,
          label: id[0].toUpperCase() + id.slice(1),
          icon: ICONS[id],
          count: 0,
          nodes: [],
        })),
      };
    }
    return { categories };
  }, [data]);
}

/* ── Page ────────────────────────────────────────────────────── */

type SortMode = "default" | "gaps-desc" | "gaps-asc" | "alpha";
type HealthFilter = "all" | "green" | "amber" | "red";

function MapPage() {
  const navigate = useNavigate();
  const { categories: baseCategories } = useGraph();
  const [activeCat, setActiveCat] = useState(baseCategories[0].id);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(
    baseCategories[0].nodes[0]?.id ?? null,
  );
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Apply search + filter + sort
  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseCategories.map((c) => {
      let nodes = c.nodes;
      if (q) nodes = nodes.filter((n) => n.label.toLowerCase().includes(q));
      if (filter !== "all")
        nodes = nodes.filter((n) => n.health.includes(filter));
      if (sort === "gaps-desc") nodes = [...nodes].sort((a, b) => b.gaps - a.gaps);
      else if (sort === "gaps-asc") nodes = [...nodes].sort((a, b) => a.gaps - b.gaps);
      else if (sort === "alpha")
        nodes = [...nodes].sort((a, b) => a.label.localeCompare(b.label));
      return { ...c, nodes, count: nodes.length };
    });
  }, [baseCategories, search, filter, sort]);

  const currentCat =
    categories.find((c) => c.id === activeCat) ?? categories[0];
  const activeNode =
    currentCat.nodes.find((n) => n.id === activeNodeId) ??
    currentCat.nodes[0] ??
    null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="fixed inset-0 overflow-hidden text-foreground" style={{ background: "#050807" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 30% 40%, rgba(45,100,100,0.22), transparent 55%),
            radial-gradient(ellipse 60% 50% at 15% 65%, rgba(50,80,90,0.14), transparent 50%),
            radial-gradient(ellipse 40% 40% at 85% 20%, rgba(230,190,120,0.06), transparent 60%)
          `,
        }}
      />
      <StarField />

      <TopBar
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
        onZoomOut={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
        onNewSession={() => navigate({ to: "/wisdom" })}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        onShare={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast("Link copied");
          } catch {
            showToast("Copy failed");
          }
        }}
        onSnapshot={() => showToast("Snapshot saved")}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="absolute inset-0 pt-14 grid grid-cols-[1fr_440px] z-10">
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 origin-center transition-transform duration-500"
            style={{ transform: `scale(${zoom})` }}
          >
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
          {currentCat.nodes.length === 0 && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-xs text-white/40">No nodes match filters</div>
            </div>
          )}
        </div>
        <DetailRail node={activeNode} categoryLabel={currentCat.label} />
      </div>

      <ChatDock activeNode={activeNode} categoryLabel={currentCat.label} />

      {menuOpen && <SideMenu onClose={() => setMenuOpen(false)} />}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-2 rounded-md animate-fade-in"
          style={{
            background: "rgba(15,28,28,0.9)",
            border: `1px solid ${TEAL_SOFT}`,
            color: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(20px)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Side menu ─────────────────────────────────────────────── */

function SideMenu({ onClose }: { onClose: () => void }) {
  const links = [
    { to: "/wisdom", label: "Companion" },
    { to: "/wisdom/curse-breaker", label: "Curse Breaker" },
    { to: "/wisdom/map", label: "Constellation" },
    { to: "/wisdom/prayers", label: "Prayers" },
    { to: "/wisdom/practices", label: "Practices" },
    { to: "/wisdom/persona", label: "Persona" },
  ];
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="absolute top-14 left-2 w-56 rounded-xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(15,28,28,0.92)",
          border: `1px solid ${DIM}`,
          backdropFilter: "blur(24px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="p-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              className="block px-3 py-2 text-xs rounded-md text-white/70 hover:text-white hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────── */

function TopBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onNewSession,
  searchOpen,
  setSearchOpen,
  search,
  setSearch,
  filter,
  setFilter,
  sort,
  setSort,
  onShare,
  onSnapshot,
  menuOpen,
  setMenuOpen,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNewSession: () => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  filter: HealthFilter;
  setFilter: (v: HealthFilter) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  onShare: () => void;
  onSnapshot: () => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const [openMenu, setOpenMenu] = useState<"filter" | "sort" | null>(null);
  return (
    <div
      className="absolute top-0 left-0 right-0 h-14 z-30 flex items-center px-4 gap-3"
      style={{
        background: "rgba(8,14,14,0.55)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DIM}`,
      }}
    >
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-9 h-9 rounded-md grid place-items-center text-white/50 hover:text-white/90 hover:bg-white/5"
      >
        <Menu className="w-4 h-4" />
      </button>
      <Link to="/wisdom" className="flex items-center gap-2 pl-1 hover:opacity-90">
        <div
          className="w-8 h-8 rounded-lg grid place-items-center"
          style={{ background: TEAL_DIM, color: TEAL, border: `1px solid ${TEAL_SOFT}` }}
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium tracking-wide" style={{ color: TEAL }}>
            Wisdom
          </div>
          <div className="text-[10px] text-white/40">Constellation</div>
        </div>
      </Link>

      <div className="flex-1 flex items-center justify-center gap-1">
        <IconBtn onClick={onShare} title="Copy link">
          <Share2 className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={onZoomIn} title="Zoom in" disabled={zoom >= 1.6}>
          <Plus className="w-4 h-4" />
        </IconBtn>
        <div className="text-[10px] text-white/40 w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </div>
        <IconBtn onClick={onZoomOut} title="Zoom out" disabled={zoom <= 0.6}>
          <Minus className="w-4 h-4" />
        </IconBtn>

        <div className="relative">
          <IconBtn
            onClick={() => setOpenMenu(openMenu === "filter" ? null : "filter")}
            active={filter !== "all"}
            title="Filter by health"
          >
            <Filter className="w-4 h-4" />
          </IconBtn>
          {openMenu === "filter" && (
            <DropMenu onClose={() => setOpenMenu(null)}>
              {(["all", "green", "amber", "red"] as HealthFilter[]).map((f) => (
                <DropItem
                  key={f}
                  active={filter === f}
                  onClick={() => {
                    setFilter(f);
                    setOpenMenu(null);
                  }}
                >
                  {f === "all" ? "All health" : `${f[0].toUpperCase()}${f.slice(1)} only`}
                </DropItem>
              ))}
            </DropMenu>
          )}
        </div>

        <div className="relative">
          <IconBtn
            onClick={() => setOpenMenu(openMenu === "sort" ? null : "sort")}
            active={sort !== "default"}
            title="Sort nodes"
          >
            <ArrowUpDown className="w-4 h-4" />
          </IconBtn>
          {openMenu === "sort" && (
            <DropMenu onClose={() => setOpenMenu(null)}>
              {(
                [
                  ["default", "Default order"],
                  ["gaps-desc", "Gaps: high → low"],
                  ["gaps-asc", "Gaps: low → high"],
                  ["alpha", "Alphabetical"],
                ] as [SortMode, string][]
              ).map(([k, l]) => (
                <DropItem
                  key={k}
                  active={sort === k}
                  onClick={() => {
                    setSort(k);
                    setOpenMenu(null);
                  }}
                >
                  {l}
                </DropItem>
              ))}
            </DropMenu>
          )}
        </div>

        <IconBtn onClick={onSnapshot} title="Snapshot">
          <ImageIcon className="w-4 h-4" />
        </IconBtn>
      </div>

      <div className="flex items-center gap-2">
        {searchOpen ? (
          <div
            className="flex items-center gap-1 pl-2 pr-1 rounded-md h-9"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${DIM}` }}
          >
            <Search className="w-3.5 h-3.5 text-white/40" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes…"
              className="bg-transparent text-xs outline-none text-white/85 placeholder:text-white/35 w-40"
              onKeyDown={(e) => e.key === "Escape" && (setSearchOpen(false), setSearch(""))}
            />
            <button
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              className="w-7 h-7 grid place-items-center text-white/40 hover:text-white/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <IconBtn onClick={() => setSearchOpen(true)} title="Search">
            <Search className="w-4 h-4" />
          </IconBtn>
        )}
        <button
          onClick={onNewSession}
          className="text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{ background: TEAL, color: "#062028" }}
        >
          <Plus className="w-3.5 h-3.5" /> New session
        </button>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-9 h-9 rounded-md grid place-items-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        color: active ? GOLD : "rgba(255,255,255,0.5)",
        background: active ? "rgba(230,190,120,0.08)" : "transparent",
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = active ? "rgba(230,190,120,0.08)" : "transparent")
      }
    >
      {children}
    </button>
  );
}

function DropMenu({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute top-11 left-1/2 -translate-x-1/2 z-50 min-w-[180px] rounded-md py-1 animate-scale-in"
        style={{
          background: "rgba(15,28,28,0.95)",
          border: `1px solid ${DIM}`,
          backdropFilter: "blur(20px)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </div>
    </>
  );
}

function DropItem({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-left hover:bg-white/5"
      style={{ color: active ? GOLD : "rgba(255,255,255,0.75)" }}
    >
      <span>{children}</span>
      {active && <Check className="w-3 h-3" />}
    </button>
  );
}


/* ── Star field backdrop ─────────────────────────────────────── */

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }).map((_, i) => ({
        x: ((i * 137.5) % 100),
        y: ((i * 89.3) % 100),
        s: (i % 5) * 0.3 + 0.4,
        o: ((i % 7) * 0.08) + 0.12,
      })),
    [],
  );
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.s} fill="white" opacity={s.o} />
      ))}
    </svg>
  );
}

/* ── Graph canvas ────────────────────────────────────────────── */

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

  // fixed layout coordinates (percent of canvas)
  const ORB = { x: 18, y: 50 };
  const CAT_X = 42;
  const NODE_X = 66;

  const catCount = categories.length;
  const catYs = categories.map((_, i) => 22 + (i * 56) / Math.max(1, catCount - 1));

  const nodeCount = current.nodes.length;
  const nodeYs = current.nodes.map(
    (_, i) => 8 + (i * 84) / Math.max(1, nodeCount - 1),
  );

  return (
    <div className="relative h-full">
      {/* SVG layer with connectors */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <radialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.15" />
            <stop offset="60%" stopColor={TEAL} stopOpacity="0.05" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Halo behind orb */}
        <circle cx={ORB.x} cy={ORB.y} r="18" fill="url(#orbHalo)" />

        {/* Orb → categories */}
        {categories.map((cat, i) => {
          const isActive = cat.id === activeCat;
          const y = catYs[i];
          const c1x = ORB.x + (CAT_X - ORB.x) * 0.55;
          const d = `M ${ORB.x + 4} ${ORB.y} C ${c1x} ${ORB.y}, ${c1x} ${y}, ${CAT_X - 4} ${y}`;
          return (
            <path
              key={cat.id}
              d={d}
              stroke={isActive ? GOLD_SOFT : TEAL_DIM}
              strokeWidth={isActive ? 0.25 : 0.15}
              fill="none"
              vectorEffect="non-scaling-stroke"
              style={{ transition: "stroke 400ms ease, stroke-width 400ms ease" }}
            />
          );
        })}

        {/* Categories → nodes (only from active category) */}
        {current.nodes.map((n, i) => {
          const isActive = n.id === activeNodeId;
          const y1 = catYs[categories.findIndex((c) => c.id === activeCat)];
          const y2 = nodeYs[i];
          const c1x = CAT_X + (NODE_X - CAT_X) * 0.5;
          const d = `M ${CAT_X + 4} ${y1} C ${c1x} ${y1}, ${c1x} ${y2}, ${NODE_X - 2} ${y2}`;
          return (
            <path
              key={n.id}
              d={d}
              stroke={isActive ? GOLD : TEAL_SOFT}
              strokeWidth={isActive ? 0.3 : 0.1}
              opacity={isActive ? 1 : 0.6}
              fill="none"
              vectorEffect="non-scaling-stroke"
              style={{ transition: "all 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          );
        })}

        {/* Node endpoint dots */}
        {current.nodes.map((n, i) => (
          <circle
            key={`dot_${n.id}`}
            cx={NODE_X - 2}
            cy={nodeYs[i]}
            r={n.id === activeNodeId ? 0.4 : 0.25}
            fill={n.id === activeNodeId ? GOLD : TEAL_SOFT}
            style={{ transition: "all 400ms ease" }}
          />
        ))}
      </svg>

      {/* Orb */}
      <div
        className="absolute"
        style={{
          left: `${ORB.x}%`,
          top: `${ORB.y}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <OrbNode label="Constellation" sub="Your graph" />
      </div>

      {/* Category cards */}
      {categories.map((cat, i) => (
        <div
          key={cat.id}
          className="absolute"
          style={{
            left: `${CAT_X}%`,
            top: `${catYs[i]}%`,
            transform: "translate(-50%, -50%)",
            width: 180,
          }}
        >
          <CategoryCard
            cat={cat}
            active={cat.id === activeCat}
            onClick={() => setActiveCat(cat.id)}
          />
        </div>
      ))}

      {/* Node rows */}
      <div
        className="absolute overflow-y-auto pr-2"
        style={{
          left: `${NODE_X}%`,
          top: "4%",
          bottom: "4%",
          right: "1%",
          scrollbarWidth: "thin",
        }}
      >
        <div className="space-y-1">
          {current.nodes.map((n, i) => (
            <div
              key={n.id}
              style={{
                marginTop: i === 0 ? `calc(${nodeYs[0]}% - 22px)` : `calc(${nodeYs[i] - nodeYs[i - 1]}% - 44px)`,
              }}
            >
              <NodeRow
                node={n}
                active={n.id === activeNodeId}
                onClick={() => setActiveNodeId(n.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Orb ─────────────────────────────────────────────────────── */

function OrbNode({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="relative flex flex-col items-center animate-fade-in">
      <div className="text-center mb-3">
        <div className="text-sm font-medium text-white/85">{label}</div>
        <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>
      </div>

      <div className="relative w-36 h-36">
        {/* Outer halo */}
        <div
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${GOLD_SOFT} 0%, transparent 60%)`,
            filter: "blur(20px)",
          }}
        />
        {/* Core */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6) 0%, ${TEAL} 20%, rgba(20,60,60,0.9) 55%, #050807 100%)`,
            boxShadow: `0 0 60px ${TEAL_SOFT}, inset 0 0 40px rgba(0,0,0,0.6)`,
          }}
        />
        {/* Highlight */}
        <div
          className="absolute inset-4 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 40%)",
          }}
        />
        {/* Slow ring */}
        <div
          className="absolute -inset-3 rounded-full pointer-events-none animate-pulse"
          style={{ border: `1px solid ${TEAL_DIM}` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/50">
        <span className="text-white/30">GAPS</span>
        <span>12</span>
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
      className="w-full text-left rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all duration-300"
      style={{
        background: active ? "rgba(20,45,45,0.7)" : "rgba(15,28,28,0.55)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${active ? TEAL_SOFT : DIM}`,
        boxShadow: active
          ? `0 0 0 1px ${TEAL_DIM}, 0 12px 32px -12px rgba(120,220,210,0.35), inset 0 1px rgba(255,255,255,0.04)`
          : "inset 0 1px rgba(255,255,255,0.03), 0 12px 32px -18px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="w-8 h-8 rounded-md grid place-items-center transition-colors"
        style={{
          background: active ? TEAL_DIM : "rgba(255,255,255,0.04)",
          color: active ? TEAL : "rgba(255,255,255,0.5)",
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold leading-none text-white/90">{cat.count}</div>
        <div className="text-[11px] text-white/50 mt-1">{cat.label}</div>
      </div>
      {active && <ChevronRight className="w-4 h-4" style={{ color: GOLD }} />}
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
      className="w-full text-left rounded-md pl-3 pr-2 py-1.5 transition-all duration-300 group"
      style={{
        background: active ? "rgba(230,190,120,0.06)" : "transparent",
        borderLeft: active ? `2px solid ${GOLD}` : "2px solid transparent",
      }}
    >
      <div
        className="text-[12px] truncate transition-colors"
        style={{ color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)" }}
      >
        {node.label}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-white/35">
        <span>GAPS</span>
        <span>{node.gaps}</span>
        <HealthPips values={node.health} />
      </div>
    </button>
  );
}

function HealthPips({ values }: { values: [Health, Health, Health] }) {
  const map: Record<Health, string> = {
    green: "rgba(80,200,140,0.9)",
    amber: "rgba(230,180,90,0.9)",
    red: "rgba(220,90,90,0.9)",
  };
  return (
    <div className="flex gap-0.5 ml-1">
      {values.map((v, i) => (
        <span
          key={i}
          className="rounded-[1.5px]"
          style={{ width: 10, height: 6, background: map[v] }}
        />
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
      <div
        className="p-6 text-sm text-white/50"
        style={{ borderLeft: `1px solid ${DIM}`, background: "rgba(8,14,14,0.55)" }}
      >
        Select a node.
      </div>
    );
  }

  const detail = resolveDetail(node);

  return (
    <aside
      className="overflow-y-auto animate-fade-in"
      style={{
        borderLeft: `1px solid ${DIM}`,
        background: "rgba(10,20,20,0.72)",
        backdropFilter: "blur(24px)",
      }}
      key={node.id}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Activity className="w-3.5 h-3.5" style={{ color: TEAL }} />
            <span>{categoryLabel}</span>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ background: "rgba(80,200,140,0.12)", color: "rgba(120,220,170,0.9)" }}
          >
            Active
          </span>
        </div>

        <h2 className="text-[22px] font-medium leading-snug text-white/95 tracking-tight">
          {detail.title}
        </h2>

        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/45">
              Last updated <span className="text-white/75">Jul 20, 2026</span>
            </span>
            <button
              className="text-[10px] flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: GOLD }}
            >
              Explore details <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[12px] text-white/60 leading-relaxed">{detail.summary}</p>
        </Panel>

        {detail.scores && (
          <Panel>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-white/45">Confidence</div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: TEAL_DIM, color: TEAL }}
              >
                {detail.scores.label}
              </span>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-[40px] font-light leading-none tracking-tight text-white/95">
                {detail.scores.percent}
                <span className="text-[20px] text-white/40">%</span>
              </div>
              <div className="text-[11px] text-white/40 mb-2">{detail.scores.delta} last cycle</div>
              <div className="ml-auto flex items-end gap-[2px] h-9">
                {Array.from({ length: 34 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-sm"
                    style={{
                      height: `${25 + ((i * 37) % 70)}%`,
                      background: i > 26 ? GOLD_SOFT : TEAL_DIM,
                    }}
                  />
                ))}
              </div>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {detail.metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Panel key={m.label} padding="tight">
                <Icon className="w-3.5 h-3.5 text-white/40" />
                <div className="text-[20px] font-light mt-2 text-white/90 tracking-tight">
                  {m.value}
                </div>
                <div className="text-[10px] text-white/45 leading-tight mt-0.5">{m.label}</div>
              </Panel>
            );
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ color: GOLD }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wisdom analysis</span>
          </div>
          <Panel>
            <div className="text-[13px] font-medium text-white/90 mb-1.5">
              {detail.recommendation.title}
            </div>
            <p className="text-[12px] text-white/60 leading-relaxed">
              {detail.recommendation.body}
            </p>
          </Panel>
        </div>
      </div>
    </aside>
  );
}

function Panel({
  children,
  padding = "normal",
}: {
  children: React.ReactNode;
  padding?: "normal" | "tight";
}) {
  return (
    <div
      className={`rounded-lg ${padding === "tight" ? "p-3" : "p-3.5"}`}
      style={{
        background: "rgba(15,28,28,0.65)",
        border: `1px solid ${DIM}`,
        boxShadow: "inset 0 1px rgba(255,255,255,0.03)",
      }}
    >
      {children}
    </div>
  );
}

function resolveDetail(node: LeafNode) {
  const genericSummary =
    node.kind === "archetype"
      ? "A pattern or archetype from your graph. Names the shape, not the person."
      : node.kind === "fact"
        ? "A remembered belief in your persona graph. Editable, contestable, always yours to revise."
        : node.kind === "prayer"
          ? "A prayer scaffold rooted in Scripture. Not a script — a starting point."
          : "Detail unavailable.";
  const rec =
    node.kind === "archetype"
      ? {
          title: "Sit with the mirror",
          body:
            "Read the passage slowly. Ask where the archetype's tension lives in your week — not to imitate, but to notice.",
        }
      : node.kind === "fact"
        ? {
            title: "Test the belief",
            body:
              "Write one sentence you'd tell a friend who held this belief. Does the compassion match what you offer yourself?",
          }
        : node.kind === "prayer"
          ? {
              title: "Pray slowly",
              body:
                "Read one movement, pause, breathe. If a phrase catches, stay there. The scaffold serves you, not the other way.",
            }
          : { title: "", body: "" };
  return {
    title: node.label,
    summary: genericSummary,
    // Numeric health/score isn't backed by real data yet — omit rather than fabricate.
    scores: null as null | { percent: number; delta: string; label: string },
    metrics: [] as Array<{ label: string; value: string | number; icon: typeof Layers }>,
    recommendation: rec,
  };
}

/* ── Ambient chat dock ───────────────────────────────────────── */

function ChatDock({
  activeNode,
  categoryLabel,
}: {
  activeNode: LeafNode | null;
  categoryLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const context = activeNode ? `${categoryLabel} · ${activeNode.label}` : categoryLabel;
    const reply = activeNode
      ? `On "${activeNode.label}" (${categoryLabel}): open the right rail for the linked passage, prayer, and practice tied to this node.`
      : `Ask about a specific node by selecting it in the graph. Context: ${context}.`;
    setMessages((m) => [...m, { role: "user", text: q }, { role: "agent", text: reply }]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
  };

  return (
    <div className="fixed bottom-4 z-40" style={{ right: 456 }}>
      {open && (
        <div
          className="mb-2 w-[360px] rounded-xl overflow-hidden animate-scale-in flex flex-col"
          style={{
            background: "rgba(15,28,28,0.85)",
            backdropFilter: "blur(24px)",
            border: `1px solid ${DIM}`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.04)",
            maxHeight: 420,
          }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${DIM}` }}
          >
            <div
              className="w-6 h-6 rounded-md grid place-items-center"
              style={{ background: TEAL_DIM, color: TEAL }}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-sm font-medium text-white/85">Wisdom agent</div>
              <div className="text-[10px] text-white/40 truncate">
                {activeNode ? `On: ${activeNode.label}` : "Ambient"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 grid place-items-center text-white/40 hover:text-white/80 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 text-xs text-white/70 space-y-3 leading-relaxed min-h-[120px]"
          >
            {messages.length === 0 ? (
              <div className="text-white/50">
                Ask about any node — a pattern, an archetype, a prayer. Answers
                ground in your graph and Scripture.
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "text-white/90" : "text-white/60"}
                >
                  <div className="text-[9px] uppercase tracking-wide text-white/30 mb-0.5">
                    {m.role === "user" ? "You" : "Agent"}
                  </div>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <div
            className="p-2 flex items-center gap-2"
            style={{ borderTop: `1px solid ${DIM}` }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 bg-transparent text-xs px-2 py-1.5 outline-none text-white/85 placeholder:text-white/35"
              placeholder="Ask a question..."
            />
            <button
              onClick={send}
              className="w-8 h-8 rounded-md grid place-items-center hover:opacity-90"
              style={{ background: TEAL, color: "#062028" }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-full text-xs transition-all hover:scale-[1.02]"
        style={{
          background: "rgba(15,28,28,0.85)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${DIM}`,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        <div
          className="w-5 h-5 rounded-full grid place-items-center"
          style={{ background: TEAL_DIM, color: TEAL }}
        >
          <Bot className="w-3 h-3" />
        </div>
        <span>My agent</span>
        <ChevronRight
          className={`w-3 h-3 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
        />
      </button>
    </div>
  );
}

