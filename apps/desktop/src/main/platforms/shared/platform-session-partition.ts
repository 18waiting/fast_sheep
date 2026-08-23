// M8 shared platform partition (clean-room). persist:shop-<sanitized>.
export function sanitizeShopId(shopId: string): string {
  return shopId.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function platformPartitionFor(shopId: string): string {
  return "persist:shop-" + sanitizeShopId(shopId);
}

export function assertSafePartition(partition: string): void {
  if (!/^persist:shop-[A-Za-z0-9._-]+$/.test(partition)) {
    throw new Error("unsafe partition name: " + partition);
  }
}
