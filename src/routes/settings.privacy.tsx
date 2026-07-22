import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/wisdom/primitives";
import { exportMyData, deleteMyAccount } from "@/lib/wisdom/privacy.functions";

export const Route = createFileRoute("/settings/privacy")({
  head: () => ({ meta: [{ title: "Privacy & memory — Wisdom" }] }),
  component: Privacy,
});

function Privacy() {
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function onExport() {
    setBusy("export"); setStatus(null);
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wisdom-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Export downloaded.");
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    setBusy("delete"); setStatus(null);
    try {
      await deleteFn({ data: { confirm: "DELETE MY ACCOUNT" } });
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    } catch (e) {
      setStatus(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Privacy</p>
        <h1 className="text-3xl leading-tight">Your data, your controls.</h1>
      </header>

      <Card eyebrow="Do not remember" title="Per-message control.">
        <p>
          Any message can be marked <b>Do not remember</b> using the toggle above the composer. Those messages are excluded from durable extraction and never produce proposals.
        </p>
      </Card>

      <Card eyebrow="Rejected memory" title="Never silently returns.">
        <p>
          When you reject a proposed fact or a pattern, it stays rejected. The context assembler excludes rejected items from all future reasoning.
        </p>
      </Card>

      <Card eyebrow="Export & delete" title="Your data leaves cleanly.">
        <p>
          Export a JSON copy of every row you own, or permanently delete your account and all associated data.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onExport}
            disabled={busy !== null}
            className="rounded-lg border border-panel-border bg-panel px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
          >
            {busy === "export" ? "Exporting…" : "Export my data"}
          </button>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              Delete my account
            </button>
          ) : (
            <div className="w-full space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">
                This permanently deletes your sessions, patterns, prayers, and account. This cannot be undone.
              </p>
              <p className="text-xs text-muted-foreground">
                Type <code className="rounded bg-surface px-1">DELETE MY ACCOUNT</code> to confirm.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-panel-border bg-background px-2 py-1.5 text-sm"
                placeholder="DELETE MY ACCOUNT"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={confirmText !== "DELETE MY ACCOUNT" || busy !== null}
                  onClick={onDelete}
                  className="rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/25 disabled:opacity-50"
                >
                  {busy === "delete" ? "Deleting…" : "Yes, delete forever"}
                </button>
                <button
                  onClick={() => { setConfirmingDelete(false); setConfirmText(""); }}
                  disabled={busy !== null}
                  className="rounded-lg border border-panel-border bg-panel px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {status && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}
      </Card>

      <Card eyebrow="What Wisdom refuses" title="Guardrails, in plain language.">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>— No claim that generated text is God's direct reply to you.</li>
          <li>— No verdict of possession, family curse, or supernatural cause from thin evidence.</li>
          <li>— No inference of addiction, health, sin, or moral state from a photo.</li>
          <li>— No guaranteed material outcomes from prayer or visualization.</li>
          <li>— No streaks, faith scores, shame notifications, or public rankings.</li>
        </ul>
      </Card>
    </div>
  );
}
