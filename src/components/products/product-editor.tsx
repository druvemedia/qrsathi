"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, ArchiveRestore, ArrowDownToLine, ArrowLeft, ArrowUpFromLine, CheckCircle2, Plus, Save, SlidersHorizontal, Sparkles, Star, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BARCODE_MAP, PRODUCT_FORMATS, buildGs1String, getBarcodeFormat, validateBarcode, type LabelData } from "@/lib/barcodes";
import { api } from "@/lib/fetcher";
import type { ProductDto } from "@/lib/products";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Button, Card, Field, Input, Modal, Section, Select, Skeleton, Textarea, Tooltip } from "@/components/ui";
import { BarcodePreview, DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, GtinNotice, LabelDesigner, useBarcodeSvg, type LabelSettings } from "@/components/barcode/barcode-ui";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
const EDITOR_FORMATS = [...PRODUCT_FORMATS.map((f) => f.id), "isbn", "datamatrix"];
// Scanner (zxing) format names → our format ids, for "register scanned barcode".
const FROM_SCANNER: Record<string, string> = { EAN13: "ean13", EAN8: "ean8", UPCA: "upca", UPCE: "upce", ISBN: "isbn", Code128: "code128", Code39: "code39", Code93: "code93", ITF: "itf", ITF14: "itf14", Codabar: "codabar", DataMatrix: "datamatrix", PDF417: "pdf417", Aztec: "aztec", QRCode: "code128" };

type BarcodeRow = { format: string; value: string; source: "internal" | "assigned" | "existing"; isPrimary: boolean };
interface Form {
  name: string; sku: string; productCode: string; brand: string; category: string; variant: string; description: string; manufacturer: string;
  imageUrl: string; price: string; currency: string; stock: string; lowStockAt: string; batch: string; expiryDate: string; status: string;
  barcodes: BarcodeRow[];
}
const EMPTY: Form = {
  name: "", sku: "", productCode: "", brand: "", category: "", variant: "", description: "", manufacturer: "", imageUrl: "",
  price: "", currency: "INR", stock: "0", lowStockAt: "5", batch: "", expiryDate: "", status: "active", barcodes: [],
};

function fromDto(p: ProductDto): Form {
  return {
    name: p.name, sku: p.sku, productCode: p.productCode, brand: p.brand, category: p.category, variant: p.variant, description: p.description,
    manufacturer: p.manufacturer, imageUrl: p.imageUrl, price: p.priceMinor ? p.price : "", currency: p.currency, stock: String(p.stock),
    lowStockAt: String(p.lowStockAt), batch: p.batch, expiryDate: p.expiryDate, status: p.status,
    barcodes: p.barcodes.map((b) => ({ format: b.format, value: b.value, source: b.source as BarcodeRow["source"], isPrimary: b.isPrimary })),
  };
}

export function ProductEditor({ id }: { id?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(DEFAULT_LABEL);
  const [stockModal, setStockModal] = useState<null | "in" | "out" | "adjust">(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ categories: string[] }>("/api/products?take=1&status=all").then((r) => setCategories(r.categories)).catch(() => {});
    if (id) {
      api<{ item: ProductDto }>(`/api/products/${id}`)
        .then(({ item }) => { setSaved(item); setForm(fromDto(item)); })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
      const s = sp.get("stock");
      if (s === "in" || s === "out" || s === "adjust") setStockModal(s);
    } else {
      // Prefill from scanner / barcode generator
      const code = sp.get("barcode");
      if (code) {
        const fmt = FROM_SCANNER[sp.get("format") || ""] || (BARCODE_MAP[sp.get("format") || ""] ? sp.get("format")! : "code128");
        const v = validateBarcode(fmt, code);
        setForm((f) => ({ ...f, barcodes: [{ format: fmt, value: v.ok ? v.value : code, source: "existing", isPrimary: true }] }));
      }
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const primary = form.barcodes.find((b) => b.isPrimary) || form.barcodes[0];
  const primaryValid = primary ? validateBarcode(primary.format, primary.value) : null;
  const { svg, error } = useBarcodeSvg(primary?.format || "code128", primaryValid?.ok ? primaryValid.value : null, DEFAULT_BARCODE_STYLE);
  const priceText = form.price ? new Intl.NumberFormat("en-IN", { style: "currency", currency: form.currency }).format(Number(form.price) || 0) : "";
  const labelData: LabelData = useMemo(() => ({
    name: form.name, variant: [form.variant, form.brand].filter(Boolean).join(" · "), price: priceText, sku: form.sku,
    extra: [form.batch && `Batch ${form.batch}`, form.expiryDate && `Exp ${form.expiryDate}`].filter(Boolean).join("  "),
  }), [form.name, form.variant, form.brand, priceText, form.sku, form.batch, form.expiryDate]);

  /** Client-side checks mirroring the server rules, so mistakes show inline before submitting. */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Enter a product name.";
    if (!form.sku.trim()) e.sku = "Enter an SKU — it identifies the product in your inventory.";
    else if (!/^[\w\-./ ]+$/.test(form.sku.trim())) e.sku = "Use letters, numbers, spaces and - _ . / only.";
    if (form.price && !/^\d{1,9}(\.\d{1,2})?$/.test(form.price.replace(/[,₹\s]/g, ""))) e.price = "Enter a price like 199 or 199.50.";
    if (form.lowStockAt && !/^\d+$/.test(form.lowStockAt.trim())) e.lowStockAt = "Use a whole number, e.g. 5.";
    if (!id && form.stock && !/^\d+$/.test(form.stock.trim())) e.stock = "Use a whole number, e.g. 24.";
    if (form.imageUrl && !/^https?:\/\/\S+$/i.test(form.imageUrl.trim())) e.imageUrl = "The image link must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (saving) return;
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, expiryDate: form.expiryDate || null, status: undefined as string | undefined };
      if (id) {
        const { stock: _s, ...rest } = payload;
        const { item } = await api<{ item: ProductDto }>(`/api/products/${id}`, { method: "PATCH", json: rest });
        setSaved(item);
        setForm(fromDto(item));
        setHistoryKey((k) => k + 1);
        toast.success("Product saved");
      } else {
        const { item } = await api<{ item: ProductDto }>("/api/products", { method: "POST", json: payload });
        toast.success("Product created");
        router.replace(`/products/${item.id}`);
      }
    } catch (e) {
      // Keep everything the user typed; point at the field the server complained about where we can.
      const msg = e instanceof Error ? e.message : "Could not save";
      if (/SKU/i.test(msg)) setErrors((x) => ({ ...x, sku: msg }));
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "active" | "archived", silent = false) => {
    try {
      const { item } = await api<{ item: ProductDto }>(`/api/products/${id}`, { method: "PATCH", json: { status } });
      setSaved(item);
      setForm((f) => ({ ...f, status: item.status }));
      setHistoryKey((k) => k + 1);
      if (silent) return;
      if (status === "archived") toast.success("Product archived", { action: { label: "Undo", onClick: () => setStatus("active", true) } });
      else toast.success("Product restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[520px] rounded-xl" /></div>;

  const req = (k: string) => ({ invalid: !!errors[k], "aria-describedby": errors[k] ? `err-${k}` : undefined });
  const sectionNo = (n: number) => <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{n}</span>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> All products</Link>
        <div className="flex flex-wrap gap-2">
          {saved && (saved.status === "active"
            ? <Button variant="outline" onClick={() => setStatus("archived")}><Archive className="h-4 w-4" /> Archive</Button>
            : <>
                <Button variant="outline" onClick={() => setStatus("active")}><ArchiveRestore className="h-4 w-4" /> Restore</Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 text-rose-600" /> Delete</Button>
              </>)}
          <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> {id ? "Save changes" : "Create product"}</Button>
        </div>
      </div>
      {saved?.status === "archived" && <Alert tone="warn" icon={<Archive className="h-4 w-4" />}>This product is archived — it&apos;s hidden from the product list and stock can&apos;t change until you restore it.</Alert>}
      <p className="text-xs text-slate-500"><span className="text-rose-500">*</span> Required fields</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Section title={<>{sectionNo(1)}Basic information</>}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" required error={errors.name} htmlFor="p-name" className="sm:col-span-2">
                <Input id="p-name" value={form.name} maxLength={150} onChange={(e) => set("name", e.target.value)} placeholder="Masala Chai 250 g" {...req("name")} />
              </Field>
              <Field label="Brand" htmlFor="p-brand"><Input id="p-brand" value={form.brand} maxLength={80} onChange={(e) => set("brand", e.target.value)} /></Field>
              <Field label="Category" htmlFor="p-cat" hint="Pick an existing one or type a new category">
                <Input id="p-cat" value={form.category} maxLength={80} list="cat-list" onChange={(e) => set("category", e.target.value)} />
                <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Description" htmlFor="p-desc" className="sm:col-span-2"><Textarea id="p-desc" rows={3} value={form.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Image URL" htmlFor="p-img" error={errors.imageUrl} hint="https:// link to a product photo" className="sm:col-span-2">
                <Input id="p-img" value={form.imageUrl} maxLength={1000} onChange={(e) => set("imageUrl", e.target.value)} {...req("imageUrl")} />
              </Field>
            </div>
          </Section>

          <Section title={<>{sectionNo(2)}SKU & barcodes</>} description="The SKU is your own code; barcodes are what scanners read.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU" required error={errors.sku} hint="Unique per product, e.g. CHAI-250-MAS" htmlFor="p-sku">
                <div className="flex gap-2">
                  <Input id="p-sku" value={form.sku} maxLength={64} onChange={(e) => set("sku", e.target.value)} className="font-mono" {...req("sku")} />
                  <Tooltip label="Generate a unique SKU" side="top">
                    <Button variant="outline" size="icon" aria-label="Generate a unique SKU" onClick={async () => {
                      try { const r = await api<{ value: string }>("/api/products/next-code?format=code128"); set("sku", r.value.replace(/^INT-/, "SKU-")); setErrors((x) => ({ ...x, sku: "" })); } catch (e) { toast.error((e as Error).message); }
                    }}><Sparkles className="h-4 w-4" /></Button>
                  </Tooltip>
                </div>
              </Field>
              <Field label="Product ID" htmlFor="p-pid" hint="Optional internal / ERP ID"><Input id="p-pid" value={form.productCode} maxLength={64} onChange={(e) => set("productCode", e.target.value)} /></Field>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <BarcodeManager form={form} setBarcodes={(b) => set("barcodes", b)} />
            </div>
          </Section>

          <Section title={<>{sectionNo(3)}Price & stock</>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price" htmlFor="p-price" error={errors.price}><Input id="p-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="199.00" {...req("price")} /></Field>
              <Field label="Currency" htmlFor="p-cur"><Select id="p-cur" value={form.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Low-stock alert at" htmlFor="p-low" error={errors.lowStockAt} hint="Alert when stock ≤ this"><Input id="p-low" inputMode="numeric" value={form.lowStockAt} onChange={(e) => set("lowStockAt", e.target.value)} {...req("lowStockAt")} /></Field>
              {!id
                ? <Field label="Opening stock" htmlFor="p-stock" error={errors.stock} hint="Later changes use Stock in / out"><Input id="p-stock" inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} {...req("stock")} /></Field>
                : <p className="text-xs text-slate-500 sm:col-span-3">Stock changes are recorded as movements — use <strong>Stock in</strong>, <strong>Stock out</strong> or <strong>Adjust</strong> in the panel on the right.</p>}
            </div>
          </Section>

          <Section title={<>{sectionNo(4)}Variants & product details</>}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Variant / size / colour" htmlFor="p-var"><Input id="p-var" value={form.variant} maxLength={80} onChange={(e) => set("variant", e.target.value)} placeholder="250 g · Blue · XL" /></Field>
              <Field label="Manufacturer" htmlFor="p-mfr"><Input id="p-mfr" value={form.manufacturer} maxLength={150} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Name, address, licence no." /></Field>
            </div>
          </Section>

          <Section title={<>{sectionNo(5)}Batch & expiry</>} description="Optional — printed on labels and used for GS1 barcodes.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Batch / lot number" htmlFor="p-batch"><Input id="p-batch" value={form.batch} maxLength={40} onChange={(e) => set("batch", e.target.value)} /></Field>
              <Field label="Expiry date" htmlFor="p-exp"><Input id="p-exp" type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} /></Field>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving} size="lg" className="w-full sm:w-auto"><Save className="h-4 w-4" /> {id ? "Save changes" : "Create product"}</Button>
          </div>

          {id && saved && <StockHistory productId={id} refreshKey={historyKey} />}
        </div>

        <div className="space-y-4 self-start lg:sticky lg:top-24">
          {saved && (
            <Card className="p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-slate-500">In stock</p>
                  <p className="font-serif text-4xl tabular-nums">{saved.stock}</p>
                </div>
                {saved.lowStock ? <Badge tone="amber">Low stock (≤ {saved.lowStockAt})</Badge> : <Badge tone="green">OK</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button size="sm" onClick={() => setStockModal("in")} disabled={saved.status !== "active"}><ArrowDownToLine className="h-4 w-4" /> In</Button>
                <Button size="sm" variant="outline" onClick={() => setStockModal("out")} disabled={saved.status !== "active"}><ArrowUpFromLine className="h-4 w-4" /> Out</Button>
                <Button size="sm" variant="outline" onClick={() => setStockModal("adjust")} disabled={saved.status !== "active"}><SlidersHorizontal className="h-4 w-4" /> Adjust</Button>
              </div>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg font-medium">Barcode & label</h2>
            <BarcodePreview svg={svg} error={error || (primaryValid && !primaryValid.ok ? primaryValid.error : "")} placeholder="Add a barcode to preview the label" />
            <div className="mt-4">
              <LabelDesigner barcodeSvg={svg} data={labelData} settings={labelSettings} onSettings={setLabelSettings} name={form.sku || form.name || "product"} />
            </div>
          </Card>
        </div>
      </div>

      {saved && stockModal && (
        <StockModal product={saved} type={stockModal} onClose={() => setStockModal(null)}
          onDone={(p) => { setSaved(p); setStockModal(null); setHistoryKey((k) => k + 1); }} />
      )}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete product permanently?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await api(`/api/products/${id}`, { method: "DELETE" }); toast.success("Product deleted"); router.push("/products"); } catch (e) { toast.error((e as Error).message); }
        }}>Delete forever</Button></>}>
        <p className="text-sm">This removes “{saved?.name}”, its barcodes and its full stock history. This can&apos;t be undone.</p>
      </Modal>
    </div>
  );
}

// ---------------- barcodes ----------------
type Mode = "sku" | "internal" | "existing" | "assigned" | "gs1";

function BarcodeManager({ form, setBarcodes }: { form: Form; setBarcodes: (b: BarcodeRow[]) => void }) {
  const [format, setFormat] = useState("ean13");
  const [mode, setMode] = useState<Mode>("internal");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const f = getBarcodeFormat(format);
  const isGs1Data = ["gs1-128", "gs1datamatrix"].includes(format);
  const gtinSource = form.barcodes.find((b) => ["ean13", "upca", "ean8", "itf14"].includes(b.format) && b.source !== "internal");

  const modes = useMemo(() => {
    const m: { value: Mode; label: string }[] = [];
    if (isGs1Data) m.push({ value: "gs1", label: "Build from GTIN + batch + expiry" });
    if (["code128", "code39"].includes(format)) m.push({ value: "sku", label: "Use the SKU" });
    if (["ean13", "ean8", "upca", "code128", "code39"].includes(format)) m.push({ value: "internal", label: "Generate internal number" });
    m.push({ value: "existing", label: "Existing barcode on the product" });
    if (f.gtinLike) m.push({ value: "assigned", label: "My GS1-allocated GTIN" });
    return m;
  }, [format, isGs1Data, f.gtinLike]);
  useEffect(() => { if (!modes.some((m) => m.value === mode)) setMode(modes[0].value); }, [modes, mode]);

  const candidate = mode === "sku" ? form.sku : mode === "gs1" && gtinSource ? buildGs1String(gtinSource.value, form.batch, form.expiryDate || null) : value;
  const v = candidate ? validateBarcode(format, candidate) : null;

  const add = (val: string, source: BarcodeRow["source"]) => {
    if (form.barcodes.some((b) => b.format === format && b.value === val)) return toast.error("That barcode is already listed.");
    setBarcodes([...form.barcodes, { format, value: val, source, isPrimary: form.barcodes.length === 0 }]);
    setValue("");
    toast.success(`${f.label} added`);
  };

  const onAdd = async () => {
    if (mode === "internal" && !value) {
      setBusy(true);
      try {
        const r = await api<{ value: string }>(`/api/products/next-code?format=${format}`);
        add(r.value, "internal");
      } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      return;
    }
    if (!v || !v.ok) return toast.error(v && !v.ok ? v.error : "Enter a barcode value.");
    add(v.value, mode === "assigned" ? "assigned" : mode === "existing" ? "existing" : "internal");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Barcodes</h3>
        <p className="text-sm text-slate-500">A product can carry several codes (e.g. an EAN-13 on the pack and a GS1-128 on the carton). Scans of any of them find this product.</p>
      </div>
      {form.barcodes.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {form.barcodes.map((b, i) => {
            const ok = validateBarcode(b.format, b.value).ok;
            return (
              <li key={`${b.format}-${b.value}`} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <button onClick={() => setBarcodes(form.barcodes.map((x, j) => ({ ...x, isPrimary: i === j })))} aria-label="Make primary" title={b.isPrimary ? "Primary barcode" : "Make primary"}>
                  <Star className={b.isPrimary ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-300 hover:text-amber-400"} />
                </button>
                <Badge>{BARCODE_MAP[b.format]?.label || b.format}</Badge>
                <span className="min-w-0 flex-1 break-all font-mono text-sm">{b.value}</span>
                <Badge tone={b.source === "internal" ? "blue" : b.source === "assigned" ? "green" : "slate"}>
                  {b.source === "internal" ? "Internal — not a GTIN" : b.source === "assigned" ? "GS1-allocated" : "Existing"}
                </Badge>
                {!ok && <Badge tone="rose">Invalid</Badge>}
                <button onClick={() => { const next = form.barcodes.filter((_, j) => j !== i); if (next.length && !next.some((x) => x.isPrimary)) next[0].isPrimary = true; setBarcodes(next); }}
                  className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Remove barcode"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/40">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Format">
            <Select value={format} onChange={(e) => { setFormat(e.target.value); setValue(""); }}>
              {EDITOR_FORMATS.map((id) => <option key={id} value={id}>{BARCODE_MAP[id].label}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>{modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
          </Field>
        </div>
        {mode === "sku" && <p className="text-sm">Encodes the SKU: <span className="font-mono">{form.sku || "—"}</span></p>}
        {mode === "gs1" && (gtinSource
          ? <p className="break-all text-sm">From GTIN {gtinSource.value}{form.batch && `, batch ${form.batch}`}{form.expiryDate && `, expiry ${form.expiryDate}`}: <span className="font-mono">{candidate}</span></p>
          : <Alert tone="info">Add the product&apos;s existing or GS1-allocated EAN-13 / UPC-A / ITF-14 first — GS1 data must start with the product&apos;s real GTIN.</Alert>)}
        {(mode === "existing" || mode === "assigned" || mode === "internal") && (
          <Field label={mode === "internal" ? "Value (leave empty to auto-generate)" : "Barcode number / data"} error={value && v && !v.ok ? v.error : undefined}
            hint={mode === "internal" && f.gtinLike ? "Auto-generated numbers start with 2 (restricted circulation) — valid only inside your business." : f.placeholder}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" placeholder={f.placeholder} spellCheck={false} />
          </Field>
        )}
        {v?.ok && v.warnings.map((w) => <p key={w} className="text-xs text-slate-500">{w}</p>)}
        {v?.ok && candidate && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Valid {f.label}{f.gtinLike ? " — check digit OK" : ""}</p>}
        <Button size="sm" onClick={onAdd} loading={busy} disabled={form.barcodes.length >= 10 || (mode === "gs1" && !gtinSource)}><Plus className="h-4 w-4" /> Add barcode</Button>
      </div>
      <GtinNotice formatId={format} />
    </div>
  );
}

// ---------------- stock ----------------
function StockModal({ product, type, onClose, onDone }: { product: ProductDto; type: "in" | "out" | "adjust"; onClose: () => void; onDone: (p: ProductDto) => void }) {
  const [qty, setQty] = useState(type === "adjust" ? String(product.stock) : "1");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(qty);
  const valid = Number.isInteger(n) && n >= (type === "adjust" ? 0 : 1);
  const after = type === "in" ? product.stock + n : type === "out" ? product.stock - n : n;
  const submit = async () => {
    setBusy(true);
    try {
      const { item } = await api<{ item: ProductDto }>(`/api/products/${product.id}/stock`, { method: "POST", json: { type, quantity: n, note, reference } });
      toast.success(type === "in" ? `Added ${n} to stock` : type === "out" ? `Removed ${n} from stock` : `Stock set to ${n}`);
      onDone(item);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const title = type === "in" ? "Stock in (received)" : type === "out" ? "Stock out (sold / used)" : "Adjust stock (stock-take)";
  return (
    <Modal open onClose={onClose} title={title} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={type === "adjust" ? "secondary" : "primary"} onClick={submit} loading={busy} disabled={!valid || after < 0}>{!valid ? "Confirm" : type === "in" ? `Add ${n}` : type === "out" ? `Remove ${n}` : `Set stock to ${n}`}</Button></>}>
      <div className="space-y-4">
        <p className="text-sm"><strong>{product.name}</strong> · current stock <strong>{product.stock}</strong></p>
        <Field label={type === "adjust" ? "Counted quantity" : "Quantity"} error={qty && !valid ? "Enter a whole number" : after < 0 ? `Only ${product.stock} in stock` : undefined}>
          <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Reference" hint="Invoice, PO or order number (optional)"><Input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Note"><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        {valid && after >= 0 && <p className="text-sm text-slate-500">Stock after: <strong className="text-slate-900 dark:text-white">{after}</strong></p>}
        {type === "adjust" && valid && n !== product.stock && <Alert tone="warn">This replaces the recorded stock of {product.stock} with your counted quantity ({n > product.stock ? "+" : ""}{n - product.stock}). Use it after a physical stock-take.</Alert>}
      </div>
    </Modal>
  );
}

const TX_LABEL: Record<string, { label: string; tone: "green" | "rose" | "blue" | "slate" | "amber" | "violet" }> = {
  created: { label: "Created", tone: "violet" }, imported: { label: "Imported", tone: "violet" }, in: { label: "Stock in", tone: "green" },
  out: { label: "Stock out", tone: "rose" }, adjust: { label: "Adjusted", tone: "blue" }, updated: { label: "Edited", tone: "slate" },
  archived: { label: "Archived", tone: "amber" }, restored: { label: "Restored", tone: "green" },
};

function StockHistory({ productId, refreshKey }: { productId: string; refreshKey: number }) {
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => {
    api<{ items: any[] }>(`/api/products/${productId}/history`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [productId]);
  useEffect(load, [load, refreshKey]);
  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-3"><h2 className="font-serif text-lg font-medium">Activity history</h2></div>
      {!items ? <Skeleton className="m-5 h-32" /> : items.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">No activity yet.</p> : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2 text-right">Change</th><th className="px-3 py-2 text-right">Balance</th><th className="px-5 py-2">Note / ref</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-5 py-2 text-xs text-slate-500">{formatDate(t.createdAt, true)}</td>
                  <td className="px-3 py-2"><Badge tone={TX_LABEL[t.type]?.tone || "slate"}>{TX_LABEL[t.type]?.label || t.type}</Badge></td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.quantity > 0 ? "text-emerald-600" : t.quantity < 0 ? "text-rose-600" : "text-slate-400"}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.balance}</td>
                  <td className="px-5 py-2 text-xs text-slate-500">{[t.note, t.reference && `Ref ${t.reference}`].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
