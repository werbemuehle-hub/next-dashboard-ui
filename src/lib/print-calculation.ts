export type PrintMethod = "digitaldruck" | "lfp";

export interface CalculationInput {
  quantity: number;
  materialUnitCost: number;
  printUnitCost: number;
  finishingCost: number;
  db1Percent: number;
  db2Percent: number;
}

export interface CalculationResult {
  materialCost: number;
  printCost: number;
  finishingCost: number;
  directCost: number;
  db1Amount: number;
  db2Amount: number;
  salesPrice: number;
  marginPercent: number;
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculatePrintOrder(input: CalculationInput): CalculationResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Menge muss größer als 0 sein.");
  }
  if (input.db1Percent < 0 || input.db1Percent >= 100) {
    throw new Error("DB1 muss zwischen 0 und 99,99 % liegen.");
  }
  if (input.db2Percent < 0 || input.db2Percent >= 100) {
    throw new Error("DB2 muss zwischen 0 und 99,99 % liegen.");
  }
  for (const value of [input.materialUnitCost, input.printUnitCost, input.finishingCost]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Kosten dürfen nicht negativ sein.");
    }
  }

  const materialCost = round(input.materialUnitCost * input.quantity);
  const printCost = round(input.printUnitCost * input.quantity);
  const finishingCost = round(input.finishingCost);
  const directCost = round(materialCost + printCost + finishingCost);

  const afterDb1 = round(directCost / (1 - input.db1Percent / 100));
  const salesPrice = round(afterDb1 / (1 - input.db2Percent / 100));
  const db1Amount = round(afterDb1 - directCost);
  const db2Amount = round(salesPrice - afterDb1);
  const marginPercent = salesPrice > 0
    ? round(((salesPrice - directCost) / salesPrice) * 100)
    : 0;

  return {
    materialCost,
    printCost,
    finishingCost,
    directCost,
    db1Amount,
    db2Amount,
    salesPrice,
    marginPercent,
  };
}
