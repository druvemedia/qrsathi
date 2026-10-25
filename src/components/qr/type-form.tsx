"use client";
import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { FieldDef, QrTypeDef } from "@/lib/qr-types";
import { Button, ColorInput, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { useApp } from "@/components/providers";
import { cn } from "@/lib/utils";

interface Props {
  type: QrTypeDef;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  errors: Record<string, string>;
  showErrors: boolean | Set<string>;
}

const visible = (f: FieldDef, v: Record<string, any>) => {
  if (!f.showIf) return true;
  const cur = v[f.showIf.field];
  return Array.isArray(f.showIf.equals) ? f.showIf.equals.includes(cur) : cur === f.showIf.equals;
};

/** Renders any QR type's form from its field definitions. */
export function TypeForm({ type, value, onChange, errors, showErrors }: Props) {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const errFor = (key: string) => {
    const show = showErrors === true || touched.has(key.split(".")[0]) || (showErrors instanceof Set && showErrors.has(key));
    return show ? errors[key] : undefined;
  };
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  const touch = (name: string) => setTouched((t) => (t.has(name) ? t : new Set(t).add(name)));

  return (
    <div className="grid grid-cols-2 gap-4">
      {type.fields.filter((f) => visible(f, value)).map((f) => (
        <div key={f.name} className={cn(f.half ? "col-span-2 sm:col-span-1" : "col-span-2")}>
          <FieldControl field={f} value={value[f.name]} onChange={(v) => set(f.name, v)} onBlur={() => touch(f.name)} error={errFor(f.name)} errFor={errFor} all={value} setAll={onChange} />
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  field: f, value, onChange, onBlur, error, errFor, all, setAll,
}: {
  field: FieldDef; value: any; onChange: (v: any) => void; onBlur: () => void; error?: string;
  errFor: (k: string) => string | undefined; all: Record<string, any>; setAll: (v: Record<string, any>) => void;
}) {
  const id = `f-${f.name}`;
  const common = { id, onBlur, invalid: !!error, placeholder: f.placeholder, "aria-describedby": error ? `${id}-err` : undefined };
  switch (f.kind) {
    case "textarea":
      return (
        <Field label={f.label} hint={f.hint} error={error} htmlFor={id} required={f.required}>
          <Textarea {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={f.name === "text" || f.name === "body" ? 5 : 3} />
        </Field>
      );
    case "select":
      return (
        <Field label={f.label} hint={f.hint} error={error} htmlFor={id}>
          <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
            {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      );
    case "checkbox":
      return (
        <div className="pt-7">
          <Switch checked={!!value} onChange={onChange} label={f.label} />
        </div>
      );
    case "color":
      return <ColorInput label={f.label} value={value || "#4f46e5"} onChange={onChange} />;
    case "list":
      return <ListField field={f} value={Array.isArray(value) ? value : []} onChange={onChange} errFor={errFor} error={error} />;
    case "file":
      return <FileField field={f} onUploaded={(url) => setAll({ ...all, url })} />;
    default: {
      const inputType = { url: "url", email: "email", tel: "tel", number: "number", date: "date", datetime: "datetime-local" }[f.kind as string] || "text";
      return (
        <Field label={f.label} hint={f.hint} error={error} htmlFor={id} required={f.required}>
          <Input {...common} type={inputType} inputMode={f.kind === "tel" ? "tel" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        </Field>
      );
    }
  }
}

function ListField({ field: f, value, onChange, errFor, error }: { field: FieldDef; value: Record<string, string>[]; onChange: (v: any) => void; errFor: (k: string) => string | undefined; error?: string }) {
  const blank = () => Object.fromEntries(f.fields!.map((s) => [s.name, ""]));
  const update = (i: number, k: string, v: string) => onChange(value.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  return (
    <div>
      <span className="label">{f.label}</span>
      <div className="space-y-2.5">
        {value.map((row, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className={cn("grid gap-2", f.fields!.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_1.6fr]")}>
              {f.fields!.map((s) => {
                const err = errFor(`${f.name}.${i}.${s.name}`);
                return (
                  <div key={s.name}>
                    <Input
                      aria-label={`${s.label} ${i + 1}`}
                      placeholder={s.placeholder || s.label}
                      value={row[s.name] ?? ""}
                      onChange={(e) => update(i, s.name, e.target.value)}
                      invalid={!!err}
                      type={s.kind === "url" ? "url" : "text"}
                      className="py-2"
                    />
                    {err && <p className="err">{err}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600" aria-label={`Remove item ${i + 1}`}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <Button variant="outline" size="sm" className="mt-2.5" onClick={() => onChange([...value, blank()])} disabled={value.length >= (f.maxItems || 50)}>
        <Plus className="h-3.5 w-3.5" /> Add {f.label.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}

function FileField({ field: f, onUploaded }: { field: FieldDef; onUploaded: (url: string) => void }) {
  const { user } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      onUploaded(j.item.url);
      setName(file.name);
      toast.success("File uploaded — link added below");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <Field label={f.label} hint={user ? f.hint : "Sign in to upload files to secure storage — or paste a link to a file you already host."}>
      <input ref={ref} type="file" className="hidden" accept={f.accept} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button variant="outline" onClick={() => ref.current?.click()} loading={busy} disabled={!user}>
        <Upload className="h-4 w-4" /> {name ? `Uploaded: ${name}` : "Choose file"}
      </Button>
    </Field>
  );
}
