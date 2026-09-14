#!/usr/bin/env node
// Temporary dev/controlled-bringup utility. This is not production onboarding.
import { randomInt } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase, SqliteShopRepository } from "../packages/persistence/dist/index.js";

export const CONFIRMATION_FLAG = "--confirm-create-controlled-pdd-shop";
export const CONTROLLED_PDD_SHOP_NAME = "Controlled PDD Runtime (local only)";

export const CONTROLLED_SHOP_ERROR_CODES = {
  CONFIRMATION_REQUIRED: "CONTROLLED_SHOP_CONFIRMATION_REQUIRED",
  PDD_SHOP_ALREADY_EXISTS: "CONTROLLED_SHOP_PDD_SHOP_ALREADY_EXISTS",
  LOCAL_SHOP_ID_CONFLICT: "CONTROLLED_SHOP_LOCAL_ID_CONFLICT",
};

export class ControlledShopCreationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ControlledShopCreationError";
    this.code = code;
  }
}

export function generateLocalShopId(nowMs = Date.now(), fourDigit = randomInt(0, 10_000)) {
  if (!Number.isInteger(nowMs) || nowMs < 0) throw new TypeError("nowMs must be a non-negative integer");
  if (!Number.isInteger(fourDigit) || fourDigit < 0 || fourDigit > 9_999) throw new TypeError("fourDigit must be an integer from 0 to 9999");
  return `shop-${nowMs}-${String(fourDigit).padStart(4, "0")}`;
}

export function createControlledPddShop(options = {}) {
  const db = openDatabase(options.dataRoot);
  try {
    const shops = new SqliteShopRepository(db.conn);
    const existing = shops.list();
    if (existing.some((shop) => shop.type === "pdd")) {
      throw new ControlledShopCreationError(
        CONTROLLED_SHOP_ERROR_CODES.PDD_SHOP_ALREADY_EXISTS,
        "an existing PDD Shop is already present; controlled creation fails closed",
      );
    }

    const id = generateLocalShopId(options.nowMs, options.fourDigit);
    if (existing.some((shop) => shop.id === id)) {
      throw new ControlledShopCreationError(
        CONTROLLED_SHOP_ERROR_CODES.LOCAL_SHOP_ID_CONFLICT,
        "generated local Shop ID already exists; controlled creation fails closed",
      );
    }

    shops.add({
      id,
      type: "pdd",
      name: CONTROLLED_PDD_SHOP_NAME,
      enabled: true,
      order: 0,
      created_time: null,
    });
    return id;
  } finally {
    db.conn.close();
  }
}

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new ControlledShopCreationError(
      CONTROLLED_SHOP_ERROR_CODES.CONFIRMATION_REQUIRED,
      `missing required confirmation flag: ${CONFIRMATION_FLAG}`,
    );
  }
  const id = createControlledPddShop();
  process.stdout.write(id + "\n");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const code = error?.code ? `${error.code}: ` : "";
    process.stderr.write(code + (error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  });
}
