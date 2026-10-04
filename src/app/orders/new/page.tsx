"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculatePrintOrder, type PrintMethod } from "@/lib/print-calculation";
import { calculateMaterialCost, calculateSheetLayout, type MaterialForCalculation } from "@/lib/material-calculation";

type FormState = {
  orderNumber: string;
  customerName: string;
  productName: string;
  width: string;
  height: string;
  materialName: string;
  nutzen: string;
  printMethod: PrintMethod;
  quantity: string;
  materialUnitCost: string;
  printUnitCost: string;
  finishingCost: string;
  db1Percent: string;
  db2Percent: string;
};

const initialForm: FormState = {
  orderNumber: "",
  customerName: "",
  productName: "",
  width: "210",
  height: "297",
  materialName: "",
  nutzen: "1",
  printMethod: "digitaldruck",
  quantity: "100",
  materialUnitCost: "0",
  printUnitCost: "0",
  finishingCost: "0",
  db1Percent: "0",
  db2Percent: "0",
};

const money = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export default function NewOrderPage() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);\n  const [materials, setMaterials] = useState<MaterialForCalculation[]>([]);\n  const [materialId, setMaterialId] = useState("");

  const selectedMaterial = materials.find((material) => material.id === materialId) ?? null;\n\n  const sheetLayout = useMemo(() => calculateSheetLayout(\n    Number(form.width), Number(form.height), Number(form.quantity),\n    selectedMaterial?.width_mm ?? null, selectedMaterial?.height_mm ?? null,\n  ), [form.width, form.height, form.quantity, selectedMaterial]);\n\n  const calculatedMaterialCost = useMemo(() => calculateMaterialCost(\n    sheetLayout, selectedMaterial?.purchase_price ?? null, selectedMaterial?.unit ?? null,\n  ), [sheetLayout, selectedMaterial]);\n\n  const result = useMemo(() => {
    try {
      return calculatePrintOrder({
        quantity: Number(form.quantity),
        materialUnitCost: calculatedMaterialCost != null ? calculatedMaterialCost / Number(form.quantity) : Number(form.materialUnitCost),
        printUnitCost: Number(form.printUnitCost),
        finishingCost: Number(form.finishingCost),
        db1Percent: Number(form.db1Percent),
        db2Percent: Number(form.db2Percent),
      });
    } catch {
      return null;
    }
  }, [form, calculatedMaterialCost]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setStatus("");
    if (!form.orderNumber || !form.customerName || !form.productName) {
      setStatus("Auftragsnummer, Kunde und Produkt sind Pflichtfelder.");
      return;
    }
    if (!result) {
      setStatus("Bitte die Kalkulationswerte prüfen.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet.");

      // Customer lookup is optional in Modul 0. The order remains valid
      // when the customer has not yet been created in the customer master.
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("company_name", form.customerName)
        .maybeSingle();

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: form.orderNumber,
          customer_id: customer?.id ?? null,
          title: form.productName,
          description: `Kunde: ${form.customerName}`,
          assigned_to: user.id,
          status: "ANFRAGE",
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { data: saved, error: calculationError } = await supabase.rpc(
        "save_order_calculation",
        {
          p_order_id: order.id,
          p_product_name: form.productName,
          p_quantity: Number(form.quantity),
          p_width_mm: Number(form.width),
          p_height_mm: Number(form.height),
          p_material_id: materialId || null,
          p_printing_method: form.printMethod,
          p_format: `${form.width} x ${form.height} mm`,
          p_colors: null,
          p_print_sides: null,
          p_copies_per_sheet: Number(form.nutzen),
          p_sheets_required: Number(form.quantity),
          p_material_cost: result.materialCost,
          p_printing_cost: result.printCost,
          p_finishing_cost: result.finishingCost,
          p_setup_cost: 0,
          p_external_cost: 0,
          p_labor_cost: 0,
          p_cost_total: result.directCost,
          p_revenue: result.salesPrice,
          p_db1: result.db1Amount,
          p_db2: result.db2Amount,
          p_margin_percent: result.marginPercent,
        },
      );

      if (calculationError) throw calculationError;

      const savedCalculation = Array.isArray(saved) ? saved[0] : saved;
      setStatus(
        `Auftrag ${form.orderNumber} gespeichert · Kalkulation ${savedCalculation?.calculation_number ?? ""} · Verkaufspreis ${money.format(result.salesPrice)}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-neutral-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Werbemühle-System</p>
          <h1 className="text-3xl font-semibold">Neuer Auftrag + Druckkalkulation</h1>
          <p className="mt-2 text-neutral-600">
            Modul 0: Produkt → Format → Material → Nutzen → Druckverfahren → Menge → Weiterverarbeitung → DB1/DB2 → Verkaufspreis.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Auftrag</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label>Auftragsnummer<input value={form.orderNumber} onChange={(e) => update("orderNumber", e.target.value)} placeholder="z. B. 2026-1001" /></label>
              <label>Kunde<input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} /></label>
              <label className="md:col-span-2">Produkt<input value={form.productName} onChange={(e) => update("productName", e.target.value)} /></label>
              <label>Breite mm<input type="number" value={form.width} onChange={(e) => update("width", e.target.value)} min="1" /></label>
              <label>Höhe mm<input type="number" value={form.height} onChange={(e) => update("height", e.target.value)} min="1" /></label>
              <label>Material<select value={materialId} onChange={(e) => { const id = e.target.value; setMaterialId(id); const material = materials.find((item) => item.id === id); update("materialName", material?.name ?? ""); }}>{materials.length === 0 ? <option value="">Noch kein Materialkatalog</option> : <><option value="">Material wählen…</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}{material.grammage_gsm ? ` · ${material.grammage_gsm} g/m²` : ""}</option>)}</>}</select></label>
              <label>Nutzen<input type="number" value={sheetLayout?.copiesPerSheet || form.nutzen} onChange={(e) => update("nutzen", e.target.value)} min="1" /><span className="mt-1 block text-xs text-neutral-500">{sheetLayout ? `${sheetLayout.copiesPerSheet} Nutzen · ${sheetLayout.sheetsRequired} Bogen` : "Bogenformat des Materials fehlt"}</span></label>
              <label>Druckverfahren<select value={form.printMethod} onChange={(e) => update("printMethod", e.target.value as PrintMethod)}><option value="digitaldruck">Digitaldruck</option><option value="lfp">LFP</option></select></label>
              <label>Menge<input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} min="1" /></label>
            </div>

            <h2 className="mb-4 mt-8 text-lg font-semibold">Kosten & Weiterverarbeitung</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label>Material €/Stk.<input type="number" step="0.0001" value={form.materialUnitCost} onChange={(e) => update("materialUnitCost", e.target.value)} min="0" /></label>
              <label>Druck €/Stk.<input type="number" step="0.0001" value={form.printUnitCost} onChange={(e) => update("printUnitCost", e.target.value)} min="0" /></label>
              <label>Weiterverarbeitung gesamt<input type="number" step="0.01" value={form.finishingCost} onChange={(e) => update("finishingCost", e.target.value)} min="0" /></label>
              <label>DB1 %<input type="number" step="0.01" value={form.db1Percent} onChange={(e) => update("db1Percent", e.target.value)} min="0" max="99.99" /></label>
              <label>DB2 %<input type="number" step="0.01" value={form.db2Percent} onChange={(e) => update("db2Percent", e.target.value)} min="0" max="99.99" /></label>
            </div>

            <button onClick={save} disabled={saving} className="mt-8 rounded-xl bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? "Speichere…" : "Auftrag + Kalkulation speichern"}
            </button>
            {status && <p className="mt-4 rounded-xl bg-neutral-100 p-3 text-sm">{status}</p>}
          </section>

          <aside className="h-fit rounded-2xl bg-neutral-900 p-6 text-white">
            <h2 className="text-lg font-semibold">Live-Kalkulation</h2>
            {result ? (
              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between"><span>Material</span><strong>{money.format(result.materialCost)}</strong></div>
                <div className="flex justify-between"><span>Druck</span><strong>{money.format(result.printCost)}</strong></div>
                <div className="flex justify-between"><span>Weiterverarbeitung</span><strong>{money.format(result.finishingCost)}</strong></div>
                <div className="border-t border-white/20 pt-4 flex justify-between"><span>Direktkosten</span><strong>{money.format(result.directCost)}</strong></div>
                <div className="flex justify-between"><span>DB1</span><strong>{money.format(result.db1Amount)}</strong></div>
                <div className="flex justify-between"><span>DB2</span><strong>{money.format(result.db2Amount)}</strong></div>
                <div className="border-t border-white/20 pt-4"><span className="text-white/70">Verkaufspreis</span><div className="mt-1 text-3xl font-bold">{money.format(result.salesPrice)}</div></div>
                <div className="flex justify-between"><span>Marge</span><strong>{result.marginPercent.toFixed(2)} %</strong></div>
              </div>
            ) : <p className="mt-4 text-white/70">Noch keine gültige Kalkulation.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
