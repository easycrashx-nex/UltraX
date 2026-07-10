import type { PasswordAutofillSnapshot, PasswordPromptSnapshot } from "@shared/password-manager";
import { KeyRound, LockKeyhole, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PasswordSavePrompt({
  prompt,
  onAction,
  onOpenPasswords,
}: {
  prompt: PasswordPromptSnapshot;
  onAction: (action: "save" | "update" | "dismiss" | "never-save") => void;
  onOpenPasswords: () => void;
}) {
  const isUpdate = prompt.action === "update";
  return (
    <section
      aria-label="UltraX Password Manager"
      className="fixed right-4 top-[116px] z-[80] w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-primary/35 bg-background/95 text-foreground shadow-2xl shadow-black/40 backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
    >
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary"><ShieldCheck className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">UltraX Password Manager</p>
          <p className="truncate text-[11px] text-muted-foreground">Trusted browser prompt</p>
        </div>
        <button type="button" aria-label="Dismiss password prompt" onClick={() => onAction("dismiss")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><X className="size-4" /></button>
      </header>
      <div className="space-y-3 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold">{isUpdate ? "Update saved password?" : "Save password to UltraX?"}</h2>
          <p className="mt-1 break-all text-xs text-muted-foreground">{prompt.origin}</p>
        </div>
        <div className="grid gap-2 rounded-xl border border-border/70 bg-secondary/35 p-3 text-xs">
          <div className="flex items-center gap-2"><UserRound className="size-4 text-primary" /><span className="truncate">{prompt.username}</span></div>
          <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><span>Password: {"•".repeat(Math.min(prompt.passwordLength, 12))}</span></div>
          {prompt.vaultLocked && <div className="flex items-center gap-2 text-amber-300"><LockKeyhole className="size-4" />Unlock the vault before saving.</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onAction("dismiss")}>Not now</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onAction("never-save")}>Never for this site</Button>
          <Button type="button" size="sm" onClick={() => onAction(isUpdate ? "update" : "save")}>{isUpdate ? "Update" : "Save"}</Button>
        </div>
        {prompt.vaultLocked && <button type="button" onClick={onOpenPasswords} className="w-full text-center text-[11px] text-primary underline-offset-2 hover:underline">Open Passwords & Autofill settings</button>}
      </div>
    </section>
  );
}

export function PasswordAutofillPopover({
  snapshot,
  onFill,
  onManage,
  onDismiss,
}: {
  snapshot: PasswordAutofillSnapshot;
  onFill: (itemId: string) => void;
  onManage: () => void;
  onDismiss: () => void;
}) {
  if (snapshot.suggestions.length === 0 && !snapshot.vaultLocked) return null;
  return (
    <section aria-label="UltraX saved accounts" className="fixed right-4 top-[116px] z-[75] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-2xl shadow-black/40 backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><KeyRound className="size-4" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold">Saved accounts</p><p className="truncate text-[11px] text-muted-foreground">{snapshot.origin}</p></div>
        <button type="button" aria-label="Dismiss saved accounts" onClick={onDismiss} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><X className="size-4" /></button>
      </header>
      {snapshot.vaultLocked ? (
        <div className="space-y-2 px-4 py-4 text-xs"><p className="font-semibold">Password vault locked</p><p className="text-muted-foreground">Unlock the vault in Passwords & Autofill before choosing an account.</p><Button type="button" size="sm" variant="outline" onClick={onManage}>Open Password Manager</Button></div>
      ) : (
        <div className="space-y-1 p-2">
          {snapshot.suggestions.map((suggestion) => <button type="button" key={suggestion.itemId} onClick={() => onFill(suggestion.itemId)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><UserRound className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{suggestion.username || suggestion.title}</span><span className="block truncate text-[10px] text-muted-foreground">{suggestion.origin}</span></span></button>)}
          <button type="button" onClick={onManage} className="w-full px-3 py-2 text-left text-[11px] text-primary hover:bg-accent">Manage passwords</button>
        </div>
      )}
    </section>
  );
}
