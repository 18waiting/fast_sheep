// SHEEP-028 clean-room Header/Navigation region component.
// The reference navbar shell region exists (SHEEP-022 CONFIRMED: nav items + top-right
// user info). Fast Sheep implementation here establishes structural regions only:
// nav taxonomy (Phase 3 IA) and the user data contract are not defined yet, so both
// regions stay empty placeholders. No reference code/assets/geometry values are ported;
// no bridge/network dependency is introduced.
import { clear, el } from "./dom.js";

// Fills a pre-created <nav class="app-navbar"> element with two structural sub-regions.
// Layout (left/right arrangement, flex alignment) is a Fast Sheep clean-room decision
// (reference-derived = NO / INFERRED; reference_match_status = NOT_ESTABLISHED).
export function renderAppNavbar(nav: HTMLElement): void {
  clear(nav);

  const navItems = el("div", "app-navbar-nav");
  navItems.setAttribute("aria-label", "主导航区");
  nav.appendChild(navItems);

  const userInfo = el("div", "app-navbar-user");
  userInfo.setAttribute("aria-label", "用户信息区");
  nav.appendChild(userInfo);
}