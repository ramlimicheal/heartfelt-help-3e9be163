import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, Sparkles } from "lucide-react";
import { listArchetypeMirrors, type ArchetypeMirror } from "@/lib/wisdom/mirrors.functions";

export const Route = createFileRoute("/mirrors")({
  head: () => ({
    meta: [
      { title: "Mirrors — Wisdom" },
      { name: "description", content: "Biblical archetypes reflected in your prayers and discernments." },
      { property: "og:title", content: "Mirrors — Wisdom" },
      { property: "og:description", content: "Biblical archetypes reflected in your prayers and discernments." },
    ],
  }),
  component: MirrorsPage,
});

function MirrorsPage() {
  const fetchMirrors = useServerFn(listArchetypeMirrors);
  const q = useQuery({
    queryKey: ["mirrors"],
    queryFn: () => fetchMirrors(),
    staleTime: 60_000,
  });

  const encountered = q.data?.encountered ?? [];
  const catalog = q.data?.catalog ?? [];
  const catalogOnly = catalog.filter((c) => !encountered.some((e) => e.id === c.id));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <Users className="size-3" /> Mirrors
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Biblical archetypes reflected in you
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every prayer Wisdom composes draws from real Scripture. The people
          behind those passages become mirrors — they've walked something like
          what you're walking, and their story is now stitched into yours.
        </p>
      </header>

      {q.isLoading && (
        <div className="rounded-2xl border border-panel-border/60 bg-surface/40 p-6 text-sm text-muted-foreground">
          Loading mirrors…
        </div>
      )}

      {!q.isLoading && (
        <>
          <section className="space-y-4">
            <SectionHeader
              icon={<Sparkles className="size-3" />}
              title="Encountered"
              caption={
                encountered.length === 0
                  ? "No mirrors yet. Ones you meet in prayer will surface here."
                  : `${encountered.length} archetype${encountered.length === 1 ? "" : "s"} have shown up in your prayers.`
              }
            />
            {encountered.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {encountered.map((a) => (
                  <MirrorCard key={a.id} archetype={a} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={<BookOpen className="size-3" />}
              title="Catalog"
              caption={`${catalogOnly.length} approved archetypes waiting to become a mirror.`}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {catalogOnly.map((a) => (
                <MirrorCard key={a.id} archetype={a} compact />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon} {title}
      </div>
      <p className="text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function MirrorCard({ archetype, compact = false }: { archetype: ArchetypeMirror; compact?: boolean }) {
  return (
    <article className="group flex flex-col gap-3 rounded-2xl border border-panel-border/70 bg-surface/50 p-5 transition-all hover:border-primary/40 hover:bg-surface/70">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{archetype.title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {archetype.summary}
          </p>
        </div>
        {archetype.encounters > 0 && (
          <span className="whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-primary">
            {archetype.encounters}×
          </span>
        )}
      </header>

      {!compact && archetype.mirrors.length > 0 && (
        <div className="space-y-1.5">
          {archetype.mirrors.slice(0, 3).map((m) => (
            <div key={m.id} className="rounded-lg border border-panel-border/60 bg-background/40 px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {m.mirrorType.replace(/_/g, " ")}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{m.description}</p>
            </div>
          ))}
        </div>
      )}

      {!compact && archetype.passages.length > 0 && (
        <div className="border-t border-panel-border/50 pt-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Passages
          </div>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-muted-foreground">
            {archetype.passages.slice(0, 3).map((p) => (
              <li key={p.id}>
                <span className="text-foreground/85">{p.reference}</span>
                <span className="ml-2 italic">{p.text.slice(0, 90)}…</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
