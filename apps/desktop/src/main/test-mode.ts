// M6 test mode: synthetic shops/conversations ONLY when FASTWORK_DESKTOP_TEST_MODE=1.
// FastWork realignment B3: PDD-only MVP, so synthetic shops are PDD shops.
import type { ShopRow } from "./services/shop-service.js";

export function isTestMode(): boolean {
  return process.env.FASTWORK_DESKTOP_TEST_MODE === "1";
}

export function syntheticShops(): ShopRow[] {
  return [
    { shop_id: "shop-test-1", name: "测试店铺A", type: "pdd", enabled: true },
    { shop_id: "shop-test-2", name: "测试店铺B", type: "pdd", enabled: true },
  ];
}

/** Map a shop id to its platform id (test mode). */
export function platformForShop(shopId: string): string | null {
  for (const s of syntheticShops()) {
    if (s.shop_id === shopId) return s.type;
  }
  return null;
}
