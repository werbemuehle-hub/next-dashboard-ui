export type MaterialForCalculation = {
  id: string;
  name: string;
  category: string | null;
  grammage_gsm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  purchase_price: number | null;
  unit: string | null;
};

export type SheetLayout = {
  copiesPerSheet: number;
  sheetsRequired: number;
};

export function calculateSheetLayout(
  productWidthMm: number,
  productHeightMm: number,
  quantity: number,
  sheetWidthMm: number | null,
  sheetHeightMm: number | null,
): SheetLayout | null {
  if (![productWidthMm, productHeightMm, quantity].every(Number.isFinite) ||
      productWidthMm <= 0 || productHeightMm <= 0 || quantity <= 0 ||
      !sheetWidthMm || !sheetHeightMm || sheetWidthMm <= 0 || sheetHeightMm <= 0) {
    return null;
  }

  const normal = Math.floor(sheetWidthMm / productWidthMm) * Math.floor(sheetHeightMm / productHeightMm);
  const rotated = Math.floor(sheetWidthMm / productHeightMm) * Math.floor(sheetHeightMm / productWidthMm);
  const copiesPerSheet = Math.max(normal, rotated);
  if (copiesPerSheet < 1) return { copiesPerSheet: 0, sheetsRequired: 0 };

  return {
    copiesPerSheet,
    sheetsRequired: Math.ceil(quantity / copiesPerSheet),
  };
}

export function calculateMaterialCost(
  layout: SheetLayout | null,
  purchasePrice: number | null,
  unit: string | null,
): number | null {
  if (!layout || layout.sheetsRequired <= 0 || purchasePrice == null || purchasePrice < 0) return null;
  if ((unit ?? "").toLowerCase() !== "bogen") return null;
  return Math.round(layout.sheetsRequired * purchasePrice * 10000) / 10000;
}
