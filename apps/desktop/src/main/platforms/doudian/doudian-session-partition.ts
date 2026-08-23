// M8 Doudian per-shop partition (clean-room). Shared persist:shop-<sanitized>.
export { platformPartitionFor as doudianPartitionFor, sanitizeShopId, assertSafePartition } from "../shared/platform-session-partition.js";
