// M6 shop sidebar component (clean-room). Local shop list; no login/embedding.
import type { UiState } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import { button, clear, el } from "./dom.js";

export function renderShopSidebar(root: HTMLElement, state: UiState, actions: WorkbenchActions): void {
  clear(root);
  const aside = el("aside", "shop-sidebar");
  aside.appendChild(el("h2", "shop-sidebar-title", "店铺"));
  const vm = state.viewModel;
  const shops = vm?.shop_summaries ?? [];
  if (shops.length === 0) {
    aside.appendChild(el("p", "shop-sidebar-empty", "暂无店铺 (平台适配器将于 M7/M8 接入)"));
  } else {
    const list = el("ul", "shop-list");
    for (const shop of shops) {
      const item = el("li", "shop-item");
      const selected = state.selectedShopId === shop.shop_id;
      const btn = button(selected ? "shop-button selected" : "shop-button", shop.name, () => actions.onSelectShop(shop.shop_id));
      btn.setAttribute("aria-current", selected ? "true" : "false");
      item.appendChild(btn);
      list.appendChild(item);
    }
    aside.appendChild(list);
  }
  root.appendChild(aside);
}
