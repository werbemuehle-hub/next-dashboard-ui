"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculatePrintOrder, type PrintMethod } from "@/lib/print-calculation";
import { calculateSheetLayout, calculateMaterialCost, type MaterialForCalculation } from "@/lib/material-calculation";

type FormState = {
  productName: string;
  width: string;
  height: string;
  nutzen: string;
  printMethod: PrintMethod;
  quantity: string;
  materialId: string;
  materialUnitCost: string;
  printUnitCost: string;
  finishingCost: string;
  db1Percent: string;
  db2Percent: string;
};

const emptyForm: FormState = {
  productName: "",
  width: "210",
  height: "297",
  nutzen: "1",
  printMethod: "digitaldruck",
  quantity: "100",
  materialId: "",
  materialUnitCost: "0",
  printUnitCost: "0",
  finishingCost: "0",
  db1Percent: "0",
  db2Percent: "0",
};

const money = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export default function OrderCalculationPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [currentCalculation, setCurrentCalculation] = useState("");
  const [materials, setMaterials] = useState<MaterialForCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === form.materialId) ?? null,
    [materials, form.materialId],
  );

  const sheetLayout = useMemo(
    () => selectedMaterial
      ? calculateSheetLayout(
          Number(form.width),
          Number(form.height),
          Number(form.quantity),
          selectedMaterial.width_mm,
          selectedMaterial.height_mm,
        )
      : null,
    [selectedMaterial, form.width, form.height, form.quantity],
  );

  const automaticMaterialCost = useMemo(
    () => calculateMaterialCost(
      sheetLayout,
      selectedMaterial?.purchase_price ?? null,
      selectedMaterial?.unit ?? null,
    ),
    [sheetLayout, selectedMaterial],
  );

  const effectiveMaterialUnitCost = automaticMaterialCost != null && Number(form.quantity) > 0
    ? automaticMaterialCost / Number(form.quantity)
    : Number(form.materialUnitCost);

  const result = useMemo(() => {
    try {
      return calculatePrintOrder({
        quantity: Number(form.quantity),
        materialUnitCost: effectiveMaterialUnitCost,
        printUnitCost: Number(form.printUnitCost),
        finishingCost: Number(form.finishingCost),
        db1Percent: Number(form.db1Percent),
        db2Percent: Number(form.db2Percent),
      });
    } catch {
      return null;
    }
  }, [form, effectiveMaterialUnitCost]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus("");
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht angemeldet.");

        const { data: materialRows, error: materialError } = await supabase
          .from("materials")
          .select("id,name,category,grammage_gsm,width_mm,height_mm,purchase_price,unit")
          .eq("active", true)
          .order("name");
        if (materialError) throw materialError;

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, title, customer_id")
          .eq("id", orderId)
          .single();
        if (orderError) throw orderError;

        let customer = null;
        if (order.customer_id) {
          const { data } = await supabase
            .from("customers")
            .select("company_name")
            .eq("id", order.customer_id)
            .maybeSingle();
          customer = data;
        }

        const { data: items, error: itemError } = await supabase
          .from("order_items")
          .select("id, article_name, quantity, width_mm, height_mm, finishing, production_method")
          .eq("order_id", orderId);
        if (itemError) throw itemError;

        const itemIds = (items ?? []).map((item) => item.id);
        let calculations: any[] = [];
        if (itemIds.length) {
          const { data, error } = await supabase
            .from("calculations")
            .select("id, order_item_id, calculation_number, quantity, material_id, printing_method, format, copies_per_sheet, material_cost, printing_cost, finishing_cost, db1, db2, revenue, margin_percent, created_at")
            .in("order_item_id", itemIds)
            .order("created_at", { ascending: false });
          if (error) throw error;
          calculations = data ?? [];
        }

        const latest = calculations[0];
        const latestItem = latest
          ? (items ?? []).find((item) => item.id === latest.order_item_id)
          : (items ?? [])[0];

        if (!active) return;

        setMaterials((materialRows ?? []) as MaterialForCalculation[]);
        setOrderNumber(order.order_number);
        setCustomerName(customer?.company_name ?? "");
        if (latest) {
          const [width = "", height = ""] = String(latest.format ?? "").replace(/ mm$/, "").split(" x ");
          const db1Amount = Number(latest.db1 ?? 0);
          const db2Amount = Number(latest.db2 ?? 0);
          const revenue = Number(latest.revenue ?? 0);
          const directCost = Number(latest.material_cost ?? 0) + Number(latest.printing_cost ?? 0) + Number(latest.finishing_cost ?? 0);
          const inferredDb1 = directCost > 0 ? Math.max(0, Math.min(99.99, (db1Amount / Math.max(directCost + db1Amount, 0.000001)) * 100)) : 0;
          const inferredDb2Base = directCost + db1Amount;
          const inferredDb2 = revenue > 0 && inferredDb2Base > 0
            ? Math.max(0, Math.min(99.99, ((revenue - inferredDb2Base) / revenue) * 100))
            : 0;

          setForm({
            productName: latestItem?.article_name ?? order.title ?? "",
            materialId: latest.material_id ?? "",
            width: width || String(latestItem?.width_mm ?? 210),
            height: height || String(latestItem?.height_mm ?? 297),
            nutzen: String(latest.copies_per_sheet ?? 1),
            printMethod: latest.printing_method === "lfp" ? "lfp" : "digitaldruck",
            quantity: String(latest.quantity ?? latestItem?.quantity ?? 100),
            materialUnitCost: latest.quantity ? String(Number(latest.material_cost ?? 0) / Number(latest.quantity)) : "0",
            printUnitCost: latest.quantity ? String(Number(latest.printing_cost ?? 0) / Number(latest.quantity)) : "0",
            finishingCost: String(latest.finishing_cost ?? 0),
            db1Percent: inferredDb1.toFixed(2),
            db2Percent: inferredDb2.toFixed(2),
          });
          setCurrentCalculation(latest.calculation_number ?? "");
        } else {
          setForm((current) => ({ ...current, productName: order.title ?? "" }));
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Auftrag konnte nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (orderId) void load();
    return () => {
      active = false;
    };
  }, [orderId]);

  async function saveNewVersion() {
    setStatus("");
    if (!result) {
      setStatus("Bitte die Kalkulationswerte prüfen.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet.");

      const { data: saved, error } = await supabase.rpc("save_order_calculation", {
        p_order_id: orderId,
        p_product_name: form.productName,
        p_quantity: Number(form.quantity),
        p_width_mm: Number(form.width),
        p_height_mm: Number(form.height),
        p_material_id: form.materialId || null,
        p_printing_method: form.printMethod,
        p_format: `${form.width} x ${form.height} mm`,
        p_colors: null,
        p_print_sides: null,
        p_copies_per_sheet: sheetLayout?.copiesPerSheet || Number(form.nutzen),
        p_sheets_required: sheetLayout?.sheetsRequired || Math.ceil(Number(form.quantity) / Number(form.nutzen)),
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
      });

      if (error) throw error;
      const savedCalculation = Array.isArray(saved) ? saved[0] : saved;
      setCurrentCalculation(savedCalculation?.calculation_number ?? "");
      setStatus(`Neue Kalkulationsversion gespeichert: ${savedCalculation?.calculation_number ?? "OK"} · ${money.format(result.salesPrice)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-neutral-100 p-6"><div className="mx-auto max-w-6xl rounded-2xl bg-white p-8">Auftrag wird geladen…</div></main>;
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-neutral-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Werbemühle-System · Druckkalkulation</p>
          <h1 className="text-3xl font-semibold">{orderNumber}</h1>
          <p className="mt-2 text-neutral-600">{customerName || "Kein Kunde hinterlegt"} · {currentCalculation || "Noch keine Kalkulation"}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Kalkulation bearbeiten</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">Produkt<input value={form.productName} onChange={(e) => update("productName", e.target.value)} /></label>
              <label>Breite mm<input type="number" value={form.width} onChange={(e) => update("width", e.target.value)} min="1" /></label>
              <label>Höhe mm<input type="number" value={form.height} onChange={(e) => update("height", e.target.value)} min="1" /></label>
              <label>Material
                <select value={form.materialId} onChange={(e) => update("materialId", e.target.value)}>
                  <option value="">Material manuell / kein Katalog</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}{material.grammage_gsm ? " · " + material.grammage_gsm + " g/m²" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>Nutzen<input type="number" value={form.nutzen} onChange={(e) => update("nutzen", e.target.value)} min="1" /></label>
              <label>Druckverfahren<select value={form.printMethod} onChange={(e) => update("printMethod", e.target.value as PrintMethod)}><option value="digitaldruck">Digitaldruck</option><option value="lfp">LFP</option></select></label>
              <label>Menge<input type="number" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} min="1" /></label>
            </div>

            <div className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm">
              {selectedMaterial ? (
                <>
                  <div className="font-semibold">{selectedMaterial.name}</div>
                  <div className="mt-1 text-neutral-600">
                    {selectedMaterial.width_mm ?? "?"} × {selectedMaterial.height_mm ?? "?"} mm · Einheit: {selectedMaterial.unit ?? "—"}
                    {selectedMaterial.purchase_price != null ? " · EK " + money.format(Number(selectedMaterial.purchase_price)) : ""}
                  </div>
                  <div className="mt-2 font-medium">
                    {sheetLayout?.copiesPerSheet ? sheetLayout.copiesPerSheet + " Nutzen · " + sheetLayout.sheetsRequired + " Bogen" : "Kein automatischer Nutzen möglich"}
                    {automaticMaterialCost != null ? " · Material " + money.format(automaticMaterialCost) : ""}
                  </div>
                </>
              ) : "Kein Material aus dem Katalog gewählt. Die Materialkosten werden aus dem manuellen Fallback übernommen."}
            </div>

            <h2 className="mb-4 mt-8 text-lg font-semibold">Kosten & Weiterverarbeitung</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label>Material €/Stk. Fallback<input type="number" step="0.0001" value={form.materialUnitCost} onChange={(e) => update("materialUnitCost", e.target.value)} min="0" /></label>
              <label>Druck €/Stk.<input type="number" step="0.0001" value={form.printUnitCost} onChange={(e) => update("printUnitCost", e.target.value)} min="0" /></label>
              <label>Weiterverarbeitung gesamt<input type="number" step="0.01" value={form.finishingCost} onChange={(e) => update("finishingCost", e.target.value)} min="0" /></label>
              <label>DB1 %<input type="number" step="0.01" value={form.db1Percent} onChange={(e) => update("db1Percent", e.target.value)} min="0" max="99.99" /></label>
              <label>DB2 %<input type="number" step="0.01" value={form.db2Percent} onChange={(e) => update("db2Percent", e.target.value)} min="0" max="99.99" /></label>
            </div>

            <button onClick={saveNewVersion} disabled={saving} className="mt-8 rounded-xl bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? "Speichere neue Version…" : "Neue Kalkulationsversion speichern"}
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
