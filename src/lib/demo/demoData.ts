/**
 * ProjectNova Demo Mode — predefined demo data.
 *
 * Everything here is static, local data for jury/demo presentation only.
 * It never reads or writes real user projects, never calls the AI Gateway,
 * and never touches auth, Supabase, or monitoring state.
 */

export interface DemoMenuItem {
  name: string;
  price: number;
  note: string;
}

export interface DemoProject {
  id: string;
  name: string;
  kind: "restaurant" | "flowers";
  tagline: string;
  menu: DemoMenuItem[];
}

export const DEMO_LIVE_URL = "https://projectnova-ai.vercel.app/";

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "demo-forkful",
    name: "Forkful",
    kind: "restaurant",
    tagline: "Fresh flavors, made with love.",
    menu: [
      { name: "Truffle Mushroom Risotto", price: 28, note: "Chef's special" },
      { name: "Pan-Seared Salmon", price: 34, note: "Fresh from the kitchen" },
      { name: "Burrata Salad", price: 18, note: "Light starter" },
      { name: "Margherita Pizza", price: 16, note: "Wood-fired" },
      { name: "Wagyu Burger", price: 24, note: "Most ordered" },
      { name: "Tiramisu", price: 12, note: "Dessert" },
    ],
  },
  {
    id: "demo-bistroflow",
    name: "BistroFlow",
    kind: "restaurant",
    tagline: "Bold flavours, crafted fresh & served with care.",
    menu: [
      { name: "Truffle Mushroom Risotto", price: 24.5, note: "Chef's special" },
      { name: "Pan-Seared Atlantic Salmon", price: 28, note: "Fresh catch" },
      { name: "Burrata and Heirloom Tomato Salad", price: 16.5, note: "Light starter" },
      { name: "Wood-Fired Margherita Pizza", price: 18, note: "Wood-fired" },
      { name: "Smoked BBQ Beef Burger", price: 21.5, note: "Most ordered" },
      { name: "Chocolate Lava Cake", price: 12, note: "Dessert" },
    ],
  },
  {
    id: "demo-rosy-bloom",
    name: "Rosy Bloom",
    kind: "flowers",
    tagline: "Colourful flower boutique.",
    menu: [
      { name: "Red Rose Bouquet", price: 25, note: "Classic favourite" },
      { name: "Sunflower Bunch", price: 18, note: "Bright and fresh" },
      { name: "Tulip Arrangement", price: 32, note: "Premium pick" },
      { name: "Lily Basket", price: 28, note: "For gifting" },
      { name: "Orchid Pot", price: 40, note: "Long-lasting" },
      { name: "Mixed Garden Posy", price: 15, note: "Everyday bunch" },
    ],
  },
];

export interface DemoTestCase {
  id: string;
  name: string;
  /** Result on the first predefined run. */
  firstRun: "pass" | "fail";
  /** Plain-language explanation shown when the case fails. */
  whyItFailed: string;
  /** What to do next, in plain language. */
  whatToDoNext: string;
}

export const DEMO_TEST_CASES: DemoTestCase[] = [
  {
    id: "demo-test-menu-renders",
    name: "Menu renders without errors",
    firstRun: "pass",
    whyItFailed: "",
    whatToDoNext: "",
  },
  {
    id: "demo-test-cart-add",
    name: "Add to Cart updates the cart",
    firstRun: "pass",
    whyItFailed: "",
    whatToDoNext: "",
  },
  {
    id: "demo-test-cart-api",
    name: "Cart API route exists",
    firstRun: "fail",
    whyItFailed:
      "Cart API route missing: the project has no /api/cart route, so cart data cannot be saved on the server.",
    whatToDoNext:
      "Add the cart route in src/api/routes.ts, then run the test again.",
  },
  {
    id: "demo-test-project-name",
    name: "No undefined project name placeholder",
    firstRun: "fail",
    whyItFailed:
      "“project is not defined”: App.tsx still contains a ${project.name} placeholder instead of a real project name.",
    whatToDoNext:
      "Replace the placeholder with the plain project name (for example Forkful), with no $ and no braces, then run the test again.",
  },
  {
    id: "demo-test-preview-build",
    name: "Preview builds cleanly",
    firstRun: "fail",
    whyItFailed:
      "Preview build failed: one file has a syntax error, such as a missing comma, so the preview cannot be built.",
    whatToDoNext:
      "Run the preview syntax repair, or fix that line, then run the test again.",
  },
  {
    id: "demo-test-gateway",
    name: "AI Gateway is reachable",
    firstRun: "fail",
    whyItFailed:
      "Gateway not reachable: the free-tier gateway may be asleep, or the site domain may not be in its allowed-origins list.",
    whatToDoNext:
      "Wake the gateway (open its health page and wait about a minute) and check the domain is in the allowed origins, then run the test again.",
  },
  {
    id: "demo-test-sync",
    name: "Edits sync across devices",
    firstRun: "fail",
    whyItFailed:
      "Data not syncing: file edits are still only in this browser and have not been moved to the cloud.",
    whatToDoNext:
      "Click “Move local to cloud”, then run the test again.",
  },
];

export type CartQuantities = Record<string, number>;

export function demoCartTotal(project: DemoProject, quantities: CartQuantities): number {
  return project.menu.reduce((sum, item) => {
    const qty = quantities[item.name] ?? 0;
    return sum + item.price * qty;
  }, 0);
}

export function demoCartCount(quantities: CartQuantities): number {
  return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
}
