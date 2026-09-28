/**
 * Shop ↔ Store 显式映射层
 * 
 * 根据 docs/architecture/SHOP_VS_STORE_SEMANTICS.md：
 * - Store = 领域模型中的身份实体（Identity Domain）
 * - Shop = 运行时/UI 层的会话上下文（Runtime/UI Domain）
 * 
 * 关联模式：
 *   Shop.id → PlatformAccount.externalRef → Store
 *   (通过 merchantId + platform 关联)
 * 
 * 所有跨域转换必须通过此文件，禁止隐式转换。
 */

import type { StoreRecord, StoreRepository, PlatformAccountRepository } from '@fastwork/persistence';

/**
 * Shop 运行时表示（UI/IPC 层使用）
 */
export interface ShopRow {
  shop_id: string;
  name: string;
  type: string;
  enabled: boolean;
}

/**
 * Shop → Store 映射结果
 */
export interface ShopToStoreMapping {
  shopId: string;
  store: StoreRecord;
  platformAccountId: string;
}

/**
 * Store → Shop 映射
 * 
 * 场景：将 Store 信息展示在 UI 上，或用于 IPC 通信。
 * 
 * 注意：这个映射需要知道 Shop.id，但 Store 本身不包含 Shop.id。
 * 通常这个映射是在创建 Shop 时建立的，或者通过 PlatformAccount.externalRef 反向查找。
 */
export function mapStoreToShopRow(store: StoreRecord, shopId: string): ShopRow {
  return {
    shop_id: shopId,              // Shop.id 需要外部提供
    name: store.name,
    type: store.platform,         // Store.platform 映射为 Shop.type
    enabled: true,                // Store 默认启用（或从其他状态读取）
  };
}

/**
 * Shop → Store 映射（核心函数）
 * 
 * 场景：从 UI 或 IPC 接收 shop_id，需要查询 Store 信息。
 * 
 * 映射逻辑：
 *   1. 通过 shop_id 查找 PlatformAccount（externalRef = shop_id）
 *   2. 通过 PlatformAccount 的 merchantId + platform 查找 Store
 * 
 * 如果找不到，返回 null（调用方需要处理）。
 */
export async function resolveStoreFromShopId(
  shopId: string,
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<ShopToStoreMapping | null> {
  // Step 1: 通过 externalRef 查找 PlatformAccount
  const account = platformAccountRepo.findByExternalRef(shopId);
  if (!account) {
    return null;
  }
  
  // Step 2: 通过 merchantId + platform 查找 Store
  const store = storeRepo.findByMerchantAndPlatform(account.merchantId, account.platform);
  if (!store) {
    return null;
  }
  
  return {
    shopId,
    store,
    platformAccountId: account.id,
  };
}

/**
 * Shop → Store 引用验证
 * 
 * 场景：需要确保 Shop 引用的 Store 存在。
 * 如果不存在，抛出错误。
 */
export async function validateStoreFromShopId(
  shopId: string,
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<ShopToStoreMapping> {
  const mapping = await resolveStoreFromShopId(shopId, platformAccountRepo, storeRepo);
  if (!mapping) {
    throw new Error(`Store not found for shopId: ${shopId}`);
  }
  return mapping;
}

/**
 * ShopSummary → Store 映射
 * 
 * 场景：从 BootstrapState 中的 ShopSummary 解析 Store。
 */
export async function resolveStoreFromShopSummary(
  summary: { shop_id: string },
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<ShopToStoreMapping | null> {
  return await resolveStoreFromShopId(summary.shop_id, platformAccountRepo, storeRepo);
}

/**
 * 批量解析 Shop → Store
 * 
 * 场景：批量转换 Shop 列表为 Store 列表。
 * 不存在的 Store 会被过滤掉。
 */
export async function resolveStoresFromShopIds(
  shopIds: string[],
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<ShopToStoreMapping[]> {
  const mappings = await Promise.all(
    shopIds.map(id => resolveStoreFromShopId(id, platformAccountRepo, storeRepo))
  );
  return mappings.filter((m): m is ShopToStoreMapping => m !== null);
}

/**
 * 检查 Shop 是否是有效的 Store 引用
 * 
 * 场景：在运行时验证 Shop 引用的 Store 是否存在。
 */
export async function isValidShopReference(
  shopId: string,
  platformAccountRepo: PlatformAccountRepository,
  storeRepo: StoreRepository
): Promise<boolean> {
  const mapping = await resolveStoreFromShopId(shopId, platformAccountRepo, storeRepo);
  return mapping !== null;
}

/**
 * 从 Store 反向查找 Shop.id
 * 
 * 场景：已知 Store，需要找到对应的 Shop.id。
 * 
 * 映射逻辑：
 *   1. 通过 merchantId + platform 查找 PlatformAccount
 *   2. 返回 PlatformAccount.externalRef（即 Shop.id）
 * 
 * 注意：一个 Store 可能对应多个 PlatformAccount（多平台场景），
 * 但在 MVP-A 阶段（单平台 PDD），一个 Store 只对应一个 PlatformAccount。
 */
export function findShopIdFromStore(
  store: StoreRecord,
  platformAccountRepo: PlatformAccountRepository
): string | null {
  const accounts = platformAccountRepo.listByMerchant(store.merchantId);
  const account = accounts.find(a => a.platform === store.platform);
  return account?.externalRef ?? null;
}
