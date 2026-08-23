// M6/M8 test mode: synthetic shops/conversations ONLY when FASTWORK_DESKTOP_TEST_MODE=1.
import type { ShopRow } from "./services/shop-service.js";

export function isTestMode(): boolean {
  return process.env.FASTWORK_DESKTOP_TEST_MODE === "1";
}

export function syntheticShops(): ShopRow[] {
  return [
    { shop_id: "shop-test-1", name: "测试店铺A", type: "pdd", enabled: true },
    { shop_id: "shop-test-2", name: "测试店铺B", type: "pdd", enabled: true },
    { shop_id: "shop-doudian-1", name: "抖店测试店铺", type: "doudian", enabled: true },
    { shop_id: "shop-jd-1", name: "京东测试店铺", type: "jd", enabled: true },
    { shop_id: "shop-kuaishou-1", name: "快手测试店铺", type: "kuaishou", enabled: true },
    { shop_id: "shop-qianniu-1", name: "千牛测试店铺", type: "qianniu", enabled: true },
    { shop_id: "shop-xianyu-1", name: "闲鱼测试店铺", type: "xianyu", enabled: true },
  ];
}

/** Map a shop id to its platform id (test mode). */
export function platformForShop(shopId: string): string | null {
  for (const s of syntheticShops()) {
    if (s.shop_id === shopId) return s.type;
  }
  return null;
}
