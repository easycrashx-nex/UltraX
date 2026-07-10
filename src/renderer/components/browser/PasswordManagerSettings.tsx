import type {
  PasswordGeneratorSettings,
  PasswordHealthSummary,
  PasswordManagerStatus,
  PasswordVaultItemDisplay,
  PasswordVaultItemInput,
} from "@shared/password-manager";
import type { BrowserSettings } from "@shared/types";
import {
  Copy,
  Download,
  ExternalLink,
  FileKey,
  Heart,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  settings: BrowserSettings;
  onUpdateSettings: (settings: Partial<BrowserSettings>) => void;
};

type EditorState = {
  id?: string;
  title: string;
  origins: string;
  username: string;
  password: string;
  notes: string;
  tags: string;
  favorite: boolean;
};

const EMPTY_EDITOR: EditorState = {
  title: "",
  origins: "",
  username: "",
  password: "",
  notes: "",
  tags: "",
  favorite: false,
};

export function PasswordManagerSettings({ settings, onUpdateSettings }: Props) {
  const [status, setStatus] = useState<PasswordManagerStatus | null>(null);
  const [items, setItems] = useState<PasswordVaultItemDisplay[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [enableQuickUnlock, setEnableQuickUnlock] = useState(true);
  const [health, setHealth] = useState<PasswordHealthSummary | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [currentMasterPassword, setCurrentMasterPassword] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const refreshItems = useCallback(async (search = query) => {
    const nextItems = await window.ultraX.passwordManager.list(search);
    setItems(nextItems);
    setSelectedId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null);
  }, [query]);

  useEffect(() => {
    let active = true;
    void window.ultraX.passwordManager.getStatus().then((nextStatus) => {
      if (!active) return;
      setStatus(nextStatus);
      setEnableQuickUnlock(nextStatus.quickUnlockAvailable);
      if (nextStatus.state === "unlocked") void refreshItems("");
    });
    const unsubscribe = window.ultraX.passwordManager.onStatusChanged((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus.state !== "unlocked") {
        setItems([]);
        setSelectedId(null);
        setEditor(null);
        setHealth(null);
      } else {
        void refreshItems("");
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [refreshItems]);

  useEffect(() => {
    if (status?.state !== "unlocked") return;
    const timer = window.setTimeout(() => {
      void refreshItems(query).catch((error) => setNotice(getErrorMessage(error)));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [query, refreshItems, status?.state]);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <VaultStateCard icon={<KeyRound />} title="Loading Password Manager" detail="Checking the local encrypted vault." />;
  }

  if (status.state === "corrupted") {
    return (
      <VaultStateCard
        icon={<ShieldCheck />}
        title="Vault needs recovery"
        detail="UltraX could not validate the encrypted vault structure. The file was not replaced. Keep the vault and its .bak copy for recovery."
      />
    );
  }

  if (status.state === "setup-required") {
    return (
      <VaultStateCard
        icon={<KeyRound />}
        title="Create your local UltraX vault"
        detail="Your master password is never stored. If you forget it and have no usable encrypted backup or OS wrapper, the vault may be unrecoverable."
      >
        <SecretField label="Master password" value={masterPassword} onChange={setMasterPassword} autoFocus />
        <SecretField label="Confirm master password" value={confirmMasterPassword} onChange={setConfirmMasterPassword} />
        {status.quickUnlockAvailable && (
          <ToggleLine
            label="Enable OS-backed quick unlock"
            detail="Uses the operating system account encryption provider. This is not biometric authentication."
            checked={enableQuickUnlock}
            onChange={setEnableQuickUnlock}
          />
        )}
        <Button
          type="button"
          disabled={busy || masterPassword.length < 12 || masterPassword !== confirmMasterPassword}
          onClick={() => void run(async () => {
            const next = await window.ultraX.passwordManager.setup(masterPassword, enableQuickUnlock);
            setStatus(next);
            setMasterPassword("");
            setConfirmMasterPassword("");
          }, "Encrypted vault created.")}
          className="w-full"
        >
          <KeyRound aria-hidden="true" />
          Create encrypted vault
        </Button>
        {notice && <Notice text={notice} />}
      </VaultStateCard>
    );
  }

  if (status.state === "locked") {
    return (
      <VaultStateCard
        icon={<Lock />}
        title="Password vault locked"
        detail="Unlocking happens locally. Repeated failed attempts are rate limited."
      >
        <SecretField label="Master password" value={masterPassword} onChange={setMasterPassword} autoFocus />
        {status.retryAfterMs && status.retryAfterMs > 0 && (
          <Notice text={`Too many attempts. Try again in ${Math.ceil(status.retryAfterMs / 1000)} seconds.`} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || masterPassword.length === 0 || Boolean(status.retryAfterMs)}
            onClick={() => void run(async () => {
              const next = await window.ultraX.passwordManager.unlock(masterPassword);
              setStatus(next);
              setMasterPassword("");
            })}
            className="flex-1"
          >
            <KeyRound aria-hidden="true" />
            Unlock vault
          </Button>
          {status.quickUnlockAvailable && status.quickUnlockConfigured && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || Boolean(status.retryAfterMs)}
              onClick={() => void run(async () => setStatus(await window.ultraX.passwordManager.unlockWithOs()))}
              className="flex-1"
            >
              <ShieldCheck aria-hidden="true" />
              OS quick unlock
            </Button>
          )}
        </div>
        {notice && <Notice text={notice} />}
      </VaultStateCard>
    );
  }

  const saveEditor = async () => {
    if (!editor) return;
    const input: PasswordVaultItemInput = {
      title: editor.title,
      origins: editor.origins.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
      username: editor.username,
      password: editor.password,
      notes: editor.notes,
      favorite: editor.favorite,
      tags: editor.tags.split(",").map((value) => value.trim()).filter(Boolean),
    };
    if (editor.id) {
      await window.ultraX.passwordManager.update(editor.id, {
        ...input,
        password: editor.password || undefined,
      });
    } else {
      await window.ultraX.passwordManager.create(input);
    }
    setEditor(null);
    await refreshItems();
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/16 text-primary"><ShieldCheck /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Local vault unlocked</h3>
          <p className="text-xs text-muted-foreground">{status.itemCount ?? items.length} encrypted login{(status.itemCount ?? items.length) === 1 ? "" : "s"}. Passwords never appear in list responses.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void run(async () => setStatus(await window.ultraX.passwordManager.lock()))}>
          <Lock aria-hidden="true" /> Lock now
        </Button>
      </section>

      <section className="grid min-h-[420px] overflow-hidden rounded-2xl border border-border/70 bg-background/32 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-border/70 p-3 lg:border-b-0 lg:border-r">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logins" className="pl-9" />
          </div>
          <Button type="button" size="sm" className="mb-3 w-full" onClick={() => setEditor({ ...EMPTY_EDITOR })}>
            <Plus aria-hidden="true" /> Add login
          </Button>
          <div className="settings-scrollbar max-h-[520px] space-y-1 overflow-y-auto pr-1">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => { setSelectedId(item.id); setEditor(null); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  item.id === selectedId ? "bg-primary/14 text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/80 text-primary"><KeyRound className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{item.title}</span>
                  <span className="block truncate text-[10px]">{item.username || item.origins[0]}</span>
                </span>
                {item.favorite && <Heart className="size-3 fill-current text-rose-400" aria-label="Favorite" />}
              </button>
            ))}
            {items.length === 0 && <p className="px-3 py-10 text-center text-xs text-muted-foreground">No saved logins</p>}
          </div>
        </div>

        <div className="min-w-0 p-5">
          {editor ? (
            <LoginEditor editor={editor} setEditor={setEditor} generator={settings.passwordManager.generator} busy={busy} onCancel={() => setEditor(null)} onSave={() => void run(saveEditor, editor.id ? "Login updated." : "Login saved and encrypted.")} />
          ) : selected ? (
            <LoginDetails
              item={selected}
              busy={busy}
              onEdit={() => setEditor({
                id: selected.id,
                title: selected.title,
                origins: selected.origins.join("\n"),
                username: selected.username,
                password: "",
                notes: selected.notes ?? "",
                tags: selected.tags.join(", "),
                favorite: selected.favorite,
              })}
              onCopy={(field) => void run(() => window.ultraX.passwordManager.copyField(selected.id, field), `${field === "password" ? "Password" : "Username"} copied.`)}
              onFill={() => void run(async () => {
                const state = await window.ultraX.getState();
                if (!state.activeTabId) throw new Error("Open the matching website in an active tab first.");
                const result = await window.ultraX.passwordManager.fill({ itemId: selected.id, tabId: state.activeTabId });
                setNotice(result.filledPassword ? `Filled the active top-level page at ${result.origin}.` : "No visible password field was found.");
              })}
              onOpen={() => void window.ultraX.navigate(selected.origins[0])}
              onDuplicate={() => void run(async () => { await window.ultraX.passwordManager.duplicate(selected.id); await refreshItems(); }, "Login duplicated.")}
              onDelete={() => {
                if (!window.confirm(`Delete ${selected.title}? This writes a new encrypted vault version.`)) return;
                void run(async () => { await window.ultraX.passwordManager.delete(selected.id); await refreshItems(); }, "Login deleted.");
              }}
            />
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center text-muted-foreground">
              <div><KeyRound className="mx-auto mb-3 size-8 opacity-60" /><p className="text-sm">Select a login or add the first one.</p></div>
            </div>
          )}
        </div>
      </section>

      {notice && <Notice text={notice} />}

      <SettingsBlock title="Saving & Autofill" detail="Only explicit user-triggered top-level fill is enabled in v1.1.9.">
        <ToggleLine label="Offer autofill" detail="Allow Fill on exact saved HTTPS origins." checked={settings.passwordManager.offerAutofill} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { offerAutofill: checked })} />
        <ToggleLine label="Fill usernames with passwords" detail="Username fill remains part of the same explicit click action." checked={settings.passwordManager.autofillUsername} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { autofillUsername: checked })} />
        <InfoLine label="Automatic save prompts" detail="Excluded from v1.1.9 until an isolated, audited form-event bridge exists. UltraX does not capture submissions silently." />
        <InfoLine label="HTTP and iframe policy" detail="Password fill is blocked on HTTP and never targets child frames." />
      </SettingsBlock>

      <SettingsBlock title="Vault Security" detail="Secure defaults apply globally to all UltraX windows.">
        <SelectLine label="Auto-lock" value={String(settings.passwordManager.autoLockMinutes)} onChange={(value) => updatePasswordSettings(settings, onUpdateSettings, { autoLockMinutes: Number(value) as BrowserSettings["passwordManager"]["autoLockMinutes"] })} options={[["1","1 minute"],["5","5 minutes"],["15","15 minutes"],["30","30 minutes"],["60","1 hour"],["0","Never while UltraX is open"]]} />
        <ToggleLine label="Lock when UltraX closes" detail="Clears the in-memory vault key before quit." checked={settings.passwordManager.lockOnAppClose} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { lockOnAppClose: checked })} />
        <ToggleLine label="Lock when all windows close" detail="Applies even on platforms that keep the app process alive." checked={settings.passwordManager.lockOnAllWindowsClosed} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { lockOnAllWindowsClosed: checked })} />
        <ToggleLine label="Lock on screen lock" detail="Uses Electron powerMonitor when supported." checked={settings.passwordManager.lockOnScreenLock} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { lockOnScreenLock: checked })} />
        <ToggleLine label="Lock on sleep" detail="Clears the vault key before system suspend." checked={settings.passwordManager.lockOnSleep} onChange={(checked) => updatePasswordSettings(settings, onUpdateSettings, { lockOnSleep: checked })} />
        <InfoLine label="OS quick unlock" detail={status.quickUnlockConfigured ? "Configured with the current OS account encryption provider." : status.quickUnlockAvailable ? "Available for new vault setup; not configured for this vault." : "Unavailable on this device."} />
      </SettingsBlock>

      <SettingsBlock title="Generator & Clipboard" detail="Generated passwords use the operating system CSPRNG through Node crypto.">
        <GeneratorDefaults settings={settings} onUpdateSettings={onUpdateSettings} />
        <SelectLine label="Clear copied passwords" value={String(settings.passwordManager.clipboardClearSeconds)} onChange={(value) => updatePasswordSettings(settings, onUpdateSettings, { clipboardClearSeconds: Number(value) as BrowserSettings["passwordManager"]["clipboardClearSeconds"] })} options={[["15","After 15 seconds"],["30","After 30 seconds"],["60","After 60 seconds"],["0","Never"]]} />
      </SettingsBlock>

      <SettingsBlock title="Local Security Review" detail="This analysis never uploads passwords or hashes.">
        <div className="p-4">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => setHealth(await window.ultraX.passwordManager.health()))}>
            <RefreshCw aria-hidden="true" /> Analyze locally
          </Button>
          {health && (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Weak" value={health.weak} /><Metric label="Reused" value={health.reused} /><Metric label="Duplicate logins" value={health.duplicateLogins} /><Metric label="Insecure origins" value={health.insecureOrigins} /><Metric label="Old (1+ year)" value={health.old} /><Metric label="Missing username" value={health.missingUsername} />
            </div>
          )}
        </div>
      </SettingsBlock>

      <SettingsBlock title="Data" detail="CSV import is explicit and encrypted backup is the only export format in v1.1.9.">
        <ActionLine icon={<Upload />} label="Import password CSV" detail="Shows plaintext warnings, validates up to 5 MB, then encrypts accepted records." action="Import" onClick={() => void run(async () => { const result = await window.ultraX.passwordManager.importCsv(); if (result) { await refreshItems(); setNotice(`Imported ${result.imported}; skipped ${result.skipped}; failed ${result.failed}. Securely delete ${result.sourceFileName}.`); } })} />
        <div className="grid gap-2 border-t border-border/60 p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <SecretField label="Encrypted backup password" value={backupPassword} onChange={setBackupPassword} />
          <Button type="button" variant="outline" size="sm" disabled={backupPassword.length < 12 || busy} onClick={() => void run(async () => { const result = await window.ultraX.passwordManager.exportBackup(backupPassword); if (result) setNotice(`Encrypted backup created with ${result.itemCount} logins.`); setBackupPassword(""); })}><Download /> Export backup</Button>
          <Button type="button" variant="outline" size="sm" disabled={backupPassword.length < 12 || busy} onClick={() => void run(async () => { const result = await window.ultraX.passwordManager.importBackup(backupPassword); if (result) { await refreshItems(); setNotice(`Authenticated backup imported: ${result.imported} logins.`); } setBackupPassword(""); })}><FileKey /> Import backup</Button>
        </div>
        <InfoLine label="Vault location" detail="Electron userData/password-manager/vault.ultraxvault (authenticated ciphertext only)." />
      </SettingsBlock>

      <SettingsBlock title="Master Password & Destructive Actions" detail="Changing the master password rewraps the random vault key and locks the vault.">
        <div className="grid gap-2 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <SecretField label="Current master password" value={currentMasterPassword} onChange={setCurrentMasterPassword} />
          <SecretField label="New master password" value={newMasterPassword} onChange={setNewMasterPassword} />
          <Button type="button" variant="outline" size="sm" disabled={busy || !currentMasterPassword || newMasterPassword.length < 12} onClick={() => void run(async () => { await window.ultraX.passwordManager.changeMasterPassword(currentMasterPassword, newMasterPassword); setCurrentMasterPassword(""); setNewMasterPassword(""); }, "Master password changed. Unlock again with the new password.")}><KeyRound /> Change</Button>
        </div>
        <div className="flex items-end gap-2 border-t border-border/60 p-4">
          <div className="min-w-0 flex-1"><SecretField label="Master password to permanently delete vault" value={currentMasterPassword} onChange={setCurrentMasterPassword} /></div>
          <Button type="button" variant="danger" size="sm" disabled={busy || !currentMasterPassword} onClick={() => { if (!window.confirm("Permanently delete the encrypted UltraX password vault and its local backup?")) return; void run(async () => { await window.ultraX.passwordManager.deleteVault(currentMasterPassword); setCurrentMasterPassword(""); }, "Vault deleted."); }}><Trash2 /> Delete vault</Button>
        </div>
      </SettingsBlock>
    </div>
  );
}

function LoginDetails({ item, busy, onEdit, onCopy, onFill, onOpen, onDuplicate, onDelete }: { item: PasswordVaultItemDisplay; busy: boolean; onEdit: () => void; onCopy: (field: "username" | "password") => void; onFill: () => void; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return <div className="space-y-4"><div className="flex items-start gap-3"><span className="grid size-12 place-items-center rounded-xl bg-primary/14 text-primary"><KeyRound /></span><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold">{item.title}</h3><p className="truncate text-xs text-muted-foreground">{item.origins.join(", ")}</p></div>{item.favorite && <Heart className="fill-current text-rose-400" />}</div><div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70"><Detail label="Username" value={item.username || "Not set"} /><Detail label="Password" value={`Masked - ${item.passwordLength} characters`} /><Detail label="Tags" value={item.tags.join(", ") || "None"} /><Detail label="Notes" value={item.notes || "None"} /><Detail label="Updated" value={new Date(item.updatedAt).toLocaleString()} /></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={onFill}><KeyRound /> Fill active page</Button><Button size="sm" variant="outline" onClick={() => onCopy("username")}><Copy /> Username</Button><Button size="sm" variant="outline" onClick={() => onCopy("password")}><Copy /> Password</Button><Button size="sm" variant="outline" onClick={onOpen}><ExternalLink /> Open site</Button><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button><Button size="sm" variant="outline" onClick={onDuplicate}>Duplicate</Button><Button size="sm" variant="danger" onClick={onDelete}><Trash2 /> Delete</Button></div></div>;
}

function LoginEditor({ editor, setEditor, generator, busy, onCancel, onSave }: { editor: EditorState; setEditor: (value: EditorState) => void; generator: PasswordGeneratorSettings; busy: boolean; onCancel: () => void; onSave: () => void }) {
  return <div className="space-y-3"><div><h3 className="text-base font-semibold">{editor.id ? "Edit login" : "Add login"}</h3><p className="text-xs text-muted-foreground">Origins are canonicalized and matched exactly.</p></div><LabeledInput label="Title" value={editor.title} onChange={(title) => setEditor({ ...editor, title })} /><LabeledInput label="Website origins" value={editor.origins} onChange={(origins) => setEditor({ ...editor, origins })} placeholder="https://example.com" /><LabeledInput label="Username" value={editor.username} onChange={(username) => setEditor({ ...editor, username })} /><div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end"><SecretField label={editor.id ? "New password (blank keeps current)" : "Password"} value={editor.password} onChange={(password) => setEditor({ ...editor, password })} /><Button type="button" variant="outline" size="sm" onClick={() => void window.ultraX.passwordManager.generate(generator).then((password) => setEditor({ ...editor, password }))}><Sparkles /> Generate</Button></div><LabeledInput label="Tags" value={editor.tags} onChange={(tags) => setEditor({ ...editor, tags })} placeholder="work, personal" /><label className="block text-xs font-medium">Notes<textarea value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} className="mt-1 min-h-20 w-full resize-y rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30" /></label><ToggleLine label="Favorite" detail="Keep this login at the top of the list." checked={editor.favorite} onChange={(favorite) => setEditor({ ...editor, favorite })} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="button" size="sm" disabled={busy || !editor.title.trim() || !editor.origins.trim() || (!editor.id && !editor.password)} onClick={onSave}>{editor.id ? "Save changes" : "Encrypt and save"}</Button></div></div>;
}

function GeneratorDefaults({ settings, onUpdateSettings }: Props) {
  const generator = settings.passwordManager.generator;
  const update = (patch: Partial<PasswordGeneratorSettings>) => updatePasswordSettings(settings, onUpdateSettings, { generator: { ...generator, ...patch } });
  return <div className="grid gap-3 p-4 md:grid-cols-2"><label className="text-xs font-medium">Default length<Input type="number" min={8} max={128} value={generator.length} onChange={(event) => update({ length: Math.max(8, Math.min(128, Number(event.target.value))) })} className="mt-1" /></label><div className="grid grid-cols-2 gap-2"><MiniCheck label="Uppercase" checked={generator.uppercase} onChange={(checked) => update({ uppercase: checked })} /><MiniCheck label="Lowercase" checked={generator.lowercase} onChange={(checked) => update({ lowercase: checked })} /><MiniCheck label="Digits" checked={generator.digits} onChange={(checked) => update({ digits: checked })} /><MiniCheck label="Symbols" checked={generator.symbols} onChange={(checked) => update({ symbols: checked })} /><MiniCheck label="Avoid ambiguous" checked={generator.avoidAmbiguous} onChange={(checked) => update({ avoidAmbiguous: checked })} /></div></div>;
}

function VaultStateCard({ icon, title, detail, children }: { icon: React.ReactNode; title: string; detail: string; children?: React.ReactNode }) { return <section className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-background/32 p-6"><span className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/14 text-primary [&_svg]:size-6">{icon}</span><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{detail}</p>{children && <div className="mt-5 space-y-3">{children}</div>}</section>; }
function SettingsBlock({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/32"><header className="border-b border-border/60 px-4 py-3"><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{detail}</p></header><div className="divide-y divide-border/60">{children}</div></section>; }
function ToggleLine({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-3"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="block text-[11px] text-muted-foreground">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" /></label>; }
function SelectLine({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="flex min-h-14 items-center gap-4 px-4 py-3"><span className="min-w-0 flex-1 text-xs font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-input bg-input px-3 text-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30">{options.map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label>; }
function InfoLine({ label, detail }: { label: string; detail: string }) { return <div className="flex min-h-14 items-center gap-4 px-4 py-3"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="block text-[11px] text-muted-foreground">{detail}</span></span></div>; }
function ActionLine({ icon, label, detail, action, onClick }: { icon: React.ReactNode; label: string; detail: string; action: string; onClick: () => void }) { return <div className="flex min-h-16 items-center gap-3 px-4 py-3"><span className="text-primary [&_svg]:size-4">{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="block text-[11px] text-muted-foreground">{detail}</span></span><Button type="button" variant="outline" size="sm" onClick={onClick}>{action}</Button></div>; }
function SecretField({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) { return <label className="block text-xs font-medium">{label}<Input type="password" value={value} autoFocus={autoFocus} autoComplete="off" onChange={(event) => onChange(event.target.value)} className="mt-1" /></label>; }
function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block text-xs font-medium">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1" /></label>; }
function MiniCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" />{label}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[120px_1fr]"><span className="text-[11px] text-muted-foreground">{label}</span><span className="break-words text-xs">{value}</span></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border/60 bg-secondary/35 p-3"><span className="block text-lg font-semibold">{value}</span><span className="text-[10px] text-muted-foreground">{label}</span></div>; }
function Notice({ text }: { text: string }) { return <div className="rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-foreground">{text}</div>; }
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "The password manager operation failed."; }
function updatePasswordSettings(settings: BrowserSettings, update: Props["onUpdateSettings"], patch: Partial<BrowserSettings["passwordManager"]>) { update({ passwordManager: { ...settings.passwordManager, ...patch } }); }
