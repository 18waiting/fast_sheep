// M6 shop service: lists clean-room Shop data only; no login.
export interface ShopRow { shop_id: string; name: string; type: string; enabled: boolean }

export interface ShopSource {
  list(): Promise<ShopRow[]>;
}

export class ShopService {
  constructor(private readonly source: ShopSource) {}

  async list(): Promise<ShopRow[]> {
    return this.source.list();
  }
}
