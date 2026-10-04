"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculatePrintOrder, type PrintMethod } from "@/lib/print-calculation";

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
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => {
    try {
      return calculatePrintOrder({
        quantity: Number(form.quantity),
        materialUnitCost: Number(form.materialUnitCost),
        printUnitCost: Number(form.printUnitCost),
        finishingCost: Number(form.finishingCost),
        db1Percent: Number(form.db1Percent),
        db2Percent: Number(form.db2Percent),
      });
    } catch {
      return null;
    }
  }, [form]);

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

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          order_number: form.orderNumber,
          customer_name: form.customerName,
          product_name: form.productName,
          quantity: Number(form.quantity),
          sales_price: result.salesPrice,
          status: "kalkuliert",
          currency: "EUR",
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: calculationError } = await supabase
        .from("order_calculations")
        .insert({
          order_id: order.id,
          version: 1,
          product_name: form.productName,
          format_width_mm: Number(form.width),
          format_height_mm: Number(form.height),
          material_name: form.materialName || null,
          nutzen: Number(form.nutzen),
          print_method: form.printMethod,
          quantity: Number(form.quantity),
          finishing: [],
          material_cost: result.materialCost,
          print_cost: result.printCost,
          finishing_cost: result.finishingCost,
          direct_cost: result.directCost,
          db1_percent: Number(form.db1Percent),
          db1_amount: result.db1Amount,
          db2_percent: Number(form.db2Percent),
          db2_amount: result.db2Amount,
          sales_price: result.salesPrice,
          margin_percent: result.marginPercent,
          currency: "EUR",
        });

      if (calculationError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw calculationError;
      }

      setStatus(`Auftrag ${form.orderNumber} wurde mit Kalkulation gespeichert.`);
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
          <p className="mt-2 text-neutral-600">Modul 0: Produkt → Format → Material → Nutzen → Druckverfahren → Menge → Weiterverarbeitung → DB1/DB2 → Verkaufspreis.</p>
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
              <label>Material<input value={form.materialName} onChange={(e) => update("materialName", e.target.value)} placeholder="z. B. 300 g Bilderdruck" /></label>
              <label>Nutzen<input type="number" value={form.nutzen} onChange={(e) => update("nutzen", e.target.value)} min="1" /></label>
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
