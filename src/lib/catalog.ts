/** Shop rules shared by the storefront, checkout and admin. Data itself lives in Lovable Cloud. */

export type DepartmentId = "women" | "accessories" | "men" | "kids" | "family" | "shoes" | "beauty" | "home-lifestyle" | "art" | "gifts" | (string & {});

export interface Department {
  id: DepartmentId;
  label: string;
  /** Departments stay disabled until the store has products for them. */
  enabled: boolean;
  sort_order?: number;
}

export interface Product {
  id: string;
  name: string;
  department: DepartmentId;
  fabric: string;
  origin: string;
  price: number;
  tag: string;
  /** Static photo shipped with the site (sample products). */
  image_url: string | null;
  /** Uploaded photo in the product-photos store. Wins over image_url. */
  image_path: string | null;
  is_new_arrival: boolean;
  is_active?: boolean;
  /** Sizes currently available. Empty = no size choice (one size). */
  sizes?: string[];
  /** Extra photos: web links, or uploaded files in the product-photos store. */
  gallery?: string[];
  created_at?: string;
}

/** The full size range shown to shoppers; sizes a product doesn't have are crossed out. */
export const SIZE_SCALE = ["XS", "S", "M", "L", "XL", "1XL", "2XL", "3XL"] as const;

/** Body measurements in inches for each size (bust, waist, hip). */
export const SIZE_GUIDE: Record<(typeof SIZE_SCALE)[number], { bust: number; waist: number; hip: number }> = {
  XS: { bust: 32.5, waist: 24, hip: 34 },
  S: { bust: 34.5, waist: 26, hip: 36 },
  M: { bust: 36.5, waist: 28, hip: 38 },
  L: { bust: 38.5, waist: 30, hip: 40 },
  XL: { bust: 40.5, waist: 32, hip: 42 },
  "1XL": { bust: 42.5, waist: 34, hip: 44 },
  "2XL": { bust: 44.5, waist: 36, hip: 46 },
  "3XL": { bust: 46.5, waist: 38, hip: 48 },
};

export const inchesToCm = (inches: number) => Math.round(inches * 2.54);

/** True when a photo/video value is an uploaded file (store path) rather than a web link. */
export const isStoredFile = (v: string) => !/^(https?:)?\//.test(v);

/** A product needs a size choice when it lists any sizes. */
export const needsSize = (p: Pick<Product, "sizes">) => (p.sizes?.length ?? 0) > 0;

export type Filter = "all" | "new" | DepartmentId;

export function isDepartmentEnabled(id: DepartmentId, departments: Department[]) {
  return departments.find((d) => d.id === id)?.enabled ?? false;
}

/** Products shown in the shop: only active ones from enabled departments, matching filter and search. */
export function visibleProducts(products: Product[], departments: Department[], filter: Filter = "all", query = "") {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    if (p.is_active === false) return false;
    if (!isDepartmentEnabled(p.department, departments)) return false;
    if (filter === "new" && !p.is_new_arrival) return false;
    if (filter !== "all" && filter !== "new" && p.department !== filter) return false;
    if (!q) return true;
    return [p.name, p.fabric, p.origin].some((v) => v.toLowerCase().includes(q));
  });
}

export interface OrderLineInput {
  productId: string;
  qty: number;
  size?: string | undefined;
}

export interface OrderLine {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size?: string | undefined;
}

/**
 * Builds order lines from the shop's own prices (never the shopper's). Unknown, hidden or
 * closed-department products are refused; quantities must be whole numbers from 1 to 20;
 * sized products need a size the product still has.
 */
export function priceOrder(lines: OrderLineInput[], products: Product[], departments: Department[]) {
  if (!lines.length) throw new Error("Your bag is empty.");
  const sellable = visibleProducts(products, departments);
  const out: OrderLine[] = lines.map((l) => {
    const p = sellable.find((x) => x.id === l.productId);
    if (!p) throw new Error("One of the items in your bag is no longer available.");
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) throw new Error("Invalid quantity.");
    if (needsSize(p)) {
      if (!l.size) throw new Error(`Please choose a size for ${p.name}.`);
      if (!p.sizes!.includes(l.size)) throw new Error(`Size ${l.size} of ${p.name} is sold out.`);
      return { productId: p.id, name: p.name, price: Number(p.price), qty: l.qty, size: l.size };
    }
    return { productId: p.id, name: p.name, price: Number(p.price), qty: l.qty };
  });
  const total = out.reduce((n, l) => n + l.price * l.qty, 0);
  return { lines: out, total };
}

export const ORDER_STATUSES = [
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["id"];

export const statusLabel = (s: string) => ORDER_STATUSES.find((x) => x.id === s)?.label ?? s;

export const formatRand = (n: number) => "R" + Number(n).toLocaleString("en-ZA");
