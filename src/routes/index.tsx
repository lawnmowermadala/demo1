import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Search, ShoppingBag, Minus, Plus, Sparkles, ShieldCheck, Truck, CheckCircle2, MapPin, Phone, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import heroImg from "@/assets/hero-ankara.jpg";
import { LOGO_SRC } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRand, needsSize, visibleProducts, type Filter, type Product } from "@/lib/catalog";
import { ProductDialog } from "@/components/shop/product-dialog";
import { SubscribeForm, subscribe, subscribeMessage } from "@/components/shop/subscribe-form";
import { Testimonials } from "@/components/shop/testimonials";
import { useProductImages } from "@/lib/product-images";
import { getStorefront, placeOrder } from "@/lib/shop.functions";
import { SHOP_CONTACT, telLink, whatsappLink } from "@/lib/contact";

const storefrontQuery = queryOptions({ queryKey: ["storefront"], queryFn: () => getStorefront() });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQuery),
  head: () => ({
    meta: [
      { title: "Tsholo R Fashion House | African Fashion for Women, Men & Family" },
      { name: "description", content: "Style that moves with you. Dress with Purpose. Shop South African Shweshwe and Ankara for women, men, kids and matching family sets, plus Kente, Mudcloth and handmade African accessories." },
      { property: "og:title", content: "Tsholo R Fashion House | Style that moves with you" },
      { property: "og:description", content: "Style that moves with you. Dress with Purpose. South African Ankara & Shweshwe for women, men and matching family sets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

type CartLine = Product & { qty: number; size?: string | undefined; key: string };

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

/** Keeps the shop's own order but lists women's products first. */
const womenFirst = (a: Product, b: Product) => Number(b.department === "women") - Number(a.department === "women");

/** The five curated edits shown in the Discover section. `dept` links an edit to a shop department. */
const EDITS: { title: string; blurb: string; dept?: string; all?: boolean }[] = [
  { title: "The Wardrobe", blurb: "Fashion.", all: true },
  { title: "The Art Edit", blurb: "African art and creative collaborations." },
  { title: "The Beauty Cabinet", blurb: "Beauty and fragrance." },
  { title: "The Objects Edit", blurb: "Accessories and lifestyle.", dept: "accessories" },
  { title: "The Gift Collection", blurb: "Thoughtful finds for the people she loves." },
];

function Shop() {
  const { data } = useSuspenseQuery(storefrontQuery);
  const { products, departments } = data;
  const images = useProductImages(products);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [step, setStep] = useState<"bag" | "details" | "done">("bag");
  const [placed, setPlaced] = useState<{ orderNumber: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState(false);
  const [viewing, setViewing] = useState<Product | null>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const list = useMemo(() => [...visibleProducts(products, departments, filter, query)].sort(womenFirst), [products, departments, filter, query]);
  const newArrivals = useMemo(() => [...visibleProducts(products, departments, "new")].sort(womenFirst).slice(0, 4), [products, departments]);
  const openDepts = departments.filter((d) => d.enabled);
  const deptOpen = (id: string) => departments.find((d) => d.id === id)?.enabled ?? false;
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const total = cart.reduce((n, l) => n + l.qty * l.price, 0);

  const add = (p: Product, size?: string, qty = 1) => {
    const key = `${p.id}:${size ?? ""}`;
    setCart((c) => {
      const hit = c.find((l) => l.key === key);
      return hit ? c.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...c, { ...p, qty, size, key }];
    });
    toast.success(`${p.name}${size ? ` (${size})` : ""} added to your bag`);
  };
  const change = (key: string, delta: number) =>
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + delta) } : l)).filter((l) => l.qty > 0));

  const pick = (f: Filter) => {
    setFilter(f);
    scrollToId("collection");
  };

  const openBag = () => {
    if (step === "done") setStep("bag");
    setBagOpen(true);
  };

  /** Slides the main menu left or right. */
  const slideMenu = (dir: 1 | -1) => menuRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  /** Main menu. Shop items follow the shop's departments and show "Soon" while a department is closed. */
  const menu: { label: string; go: () => void; soon?: boolean }[] = [
    { label: "Home", go: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { label: "New In", go: () => pick("new") },
    { label: "Women", go: () => pick("women"), soon: !deptOpen("women") },
    { label: "Men", go: () => pick("men"), soon: !deptOpen("men") },
    { label: "Baby & Little Ones", go: () => pick("kids"), soon: !deptOpen("kids") },
    { label: "Accessories", go: () => pick("accessories"), soon: !deptOpen("accessories") },
    { label: "Discover", go: () => scrollToId("discover") },
  ];

  const submitOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const customerName = String(f.get("name") ?? "");
    const customerEmail = String(f.get("email") ?? "").trim();
    if (news && !customerEmail) {
      toast.error("Please enter your email address to get our emails.");
      return;
    }
    setBusy(true);
    try {
      const res = await placeOrder({
        data: {
          customer_name: customerName,
          phone: String(f.get("phone") ?? ""),
          email: customerEmail,
          address: String(f.get("address") ?? ""),
          notes: String(f.get("notes") ?? ""),
          lines: cart.map((l) => ({ productId: l.id, qty: l.qty, size: l.size })),
        },
      });
      setPlaced(res);
      setCart([]);
      setStep("done");
      if (news) {
        // The order is already saved; signing up for news is an extra the shopper ticked.
        try {
          const r = await subscribe({ name: customerName, email: customerEmail, whatsapp: "", consentEmail: true, consentWhatsapp: false, source: "checkout" });
          toast.success(subscribeMessage(r));
        } catch {
          toast.error("Your order is saved, but we couldn't sign you up for emails. You can sign up at the bottom of the shop.");
        }
        setNews(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.startsWith("[") ? "Please check your details and try again." : msg || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const card = (p: Product) => (
    <article key={p.id} className="group flex flex-col overflow-hidden border border-border bg-card transition-shadow hover:shadow-card">
      <button type="button" onClick={() => setViewing(p)} aria-label={`View ${p.name}`} className="relative block aspect-[4/5] overflow-hidden bg-muted">
        {images[p.id] && (
          <img src={images[p.id]} alt={p.name} width={800} height={1008} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        {(p.tag || p.is_new_arrival) && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider">
            {p.tag || "New"}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-gold">{p.fabric} · {p.origin}</p>
        <h3 className="mt-1 flex-1 text-lg font-semibold leading-snug md:text-xl">
          <button type="button" onClick={() => setViewing(p)} className="text-left hover:text-gold">{p.name}</button>
        </h3>
        <p className="mt-2 font-semibold">{formatRand(p.price)}</p>
        {needsSize(p) ? (
          <Button variant="gold" className="mt-3 w-full" onClick={() => setViewing(p)}>Choose size</Button>
        ) : (
          <Button variant="gold" className="mt-3 w-full" onClick={() => add(p)}>Add to bag</Button>
        )}
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gold-soft py-2.5 text-center text-foreground eyebrow">
        African fashion · Order now, pay on confirmation · South Africa
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4 md:flex-nowrap md:px-10">
          <a href="/" className="flex items-center" aria-label="Tsholo R Fashion House home">
            <img src={LOGO_SRC} alt="Tsholo R Fashion House" width={632} height={276} className="h-14 w-auto md:h-20" />
          </a>
          <label className="order-3 flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 md:order-none md:ml-auto md:w-80">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Ankara, Shweshwe, Kente…" aria-label="Search products"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <Button variant="bag" size="default" className="ml-auto md:ml-0" onClick={openBag}>
            <ShoppingBag /> Bag ({count})
          </Button>
        </div>
        <nav aria-label="Main menu" className="border-t border-border bg-background">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 md:px-6">
            <button type="button" onClick={() => slideMenu(-1)} aria-label="Slide menu left" className="grid size-8 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-5" />
            </button>
            <ul
              ref={menuRef}
              className="flex flex-1 snap-x items-center gap-x-8 overflow-x-auto scroll-smooth whitespace-nowrap px-2 py-3 [scrollbar-width:none] md:justify-center md:gap-x-10 [&::-webkit-scrollbar]:hidden"
            >
              {menu.map((m) => (
                <li key={m.label} className="snap-start">
                  <button
                    type="button"
                    onClick={m.go}
                    disabled={m.soon}
                    className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:text-gold disabled:cursor-default disabled:text-muted-foreground/70 disabled:hover:text-muted-foreground/70"
                  >
                    {m.label}
                    {m.soon && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.55rem] tracking-wider">Soon</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => slideMenu(1)} aria-label="Slide menu right" className="grid size-8 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="bg-cream">
          {/* Full-width brand banner (public/hero-banner.png). If it fails to load the old photo is shown. */}
          <img
            src="/hero-banner.png"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fallback) return;
              el.dataset.fallback = "1";
              el.src = heroImg;
            }}
            alt="Tsholo R Fashion House. Style that moves with you. Custom designs, alterations and medical scrub uniforms. Dress with purpose."
            width={2048}
            height={768}
            className="block h-auto w-full"
          />
        </section>
        <div className="kente-rule" />

        {newArrivals.length > 0 && (
          <section className="bg-cream">
            <div className="mx-auto max-w-7xl px-5 py-14 md:px-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow text-gold">Just landed</p>
                  <h2 className="mt-2 text-4xl font-bold">New arrivals</h2>
                </div>
                <button onClick={() => pick("new")} className="text-sm font-semibold text-gold underline-offset-4 hover:underline">See all new pieces</button>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
                {newArrivals.map((p) => card(p))}
              </div>
            </div>
          </section>
        )}

        <section id="collection" className="mx-auto max-w-7xl scroll-mt-32 px-5 py-16 md:px-10">
          <div className="text-center">
            <p className="eyebrow text-gold">The collection</p>
            <h2 className="mt-2 text-4xl font-bold md:text-5xl">Shop African fashion</h2>
            <p className="mt-3 text-muted-foreground">
              {openDepts.map((d) => d.label).join(" & ")}
              {departments.some((d) => !d.enabled) && ` · ${departments.filter((d) => !d.enabled).map((d) => d.label).join(" & ")} arriving soon`}
            </p>
          </div>

          <div className="my-8 flex flex-wrap justify-center gap-2">
            {(["all", "new", ...openDepts.map((d) => d.id)] as Filter[]).map((f) => (
              <Button key={f} variant="chip" size="sm" className="h-9 rounded-full px-5" data-active={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? `All (${visibleProducts(products, departments).length})` : f === "new" ? "New arrivals" : departments.find((d) => d.id === f)?.label}
              </Button>
            ))}
          </div>

          {list.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
              {list.map((p) => card(p))}
            </div>
          ) : (
            <p className="py-16 text-center text-muted-foreground">{query ? `No pieces match “${query}”.` : "No pieces here yet."}</p>
          )}
        </section>

        <section id="discover" className="scroll-mt-32 bg-cream">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10">
            <div className="text-center">
              <p className="eyebrow text-gold">Discover</p>
              <h2 className="mt-2 text-4xl font-bold md:text-5xl">The edits</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Fashion, art, beauty and the objects we love, curated by Tsholo R Fashion House.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {EDITS.map((e) => {
                const live = e.all || (e.dept ? deptOpen(e.dept) : false);
                const go = () => (e.all ? pick("all") : e.dept ? pick(e.dept) : undefined);
                return (
                  <article key={e.title} className="flex flex-col border border-border bg-card p-6 text-center">
                    <h3 className="font-display text-2xl font-semibold leading-tight">{e.title}</h3>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">{e.blurb}</p>
                    {live ? (
                      <button type="button" onClick={go} className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-gold underline-offset-4 hover:underline">Shop</button>
                    ) : (
                      <span className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">Coming soon</span>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* STORY: the owner's story goes here. Replace the placeholder text below once it is ready. */}
        <section id="story" className="scroll-mt-32">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-10">
            <p className="eyebrow text-gold">Our story</p>
            <h2 className="mt-2 text-4xl font-bold md:text-5xl">Style that moves with you</h2>
            <p className="mt-6 text-muted-foreground">Our story is coming soon.</p>
          </div>
        </section>

        <section className="bg-sand/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 text-center sm:grid-cols-3 md:px-10">
            {[
              { icon: Sparkles, t: "Culture-led style", s: "African inspiration, modern expression" },
              { icon: ShieldCheck, t: "Pay on confirmation", s: "Online payments coming soon" },
              { icon: Truck, t: "Delivery options", s: "Shipping across South Africa" },
            ].map(({ icon: Icon, t, s }) => (
              <div key={t}>
                <Icon className="mx-auto size-6 text-gold" />
                <p className="mt-3 font-display text-xl font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
        </section>

        <Testimonials items={data.testimonials} products={products.map((p) => ({ id: p.id, name: p.name }))} />

        <section id="contact" className="mx-auto max-w-7xl px-5 py-16 md:px-10">
          <div className="text-center">
            <p className="eyebrow text-gold">Get in touch</p>
            <h2 className="mt-2 text-4xl font-bold">Visit or contact us</h2>
          </div>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            <div className="border border-border bg-card p-6 text-center">
              <MapPin className="mx-auto size-6 text-gold" />
              <p className="mt-3 font-display text-xl font-semibold">Address</p>
              <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
                {SHOP_CONTACT.addressLines.map((l) => <span key={l} className="block">{l}</span>)}
              </address>
            </div>
            <a href={whatsappLink(SHOP_CONTACT.phone, "Hi Tsholo R Fashion House, I'd like to ask about")} target="_blank" rel="noreferrer" className="border border-border bg-card p-6 text-center transition-shadow hover:shadow-card">
              <MessageCircle className="mx-auto size-6 text-gold" />
              <p className="mt-3 font-display text-xl font-semibold">WhatsApp</p>
              <p className="mt-2 text-sm text-muted-foreground">{SHOP_CONTACT.phone}</p>
              <p className="mt-1 text-xs font-semibold text-gold">Chat with us</p>
            </a>
            <a href={telLink(SHOP_CONTACT.phone)} className="border border-border bg-card p-6 text-center transition-shadow hover:shadow-card">
              <Phone className="mx-auto size-6 text-gold" />
              <p className="mt-3 font-display text-xl font-semibold">Call us</p>
              <p className="mt-2 text-sm text-muted-foreground">{SHOP_CONTACT.phone}</p>
              <p className="mt-1 text-xs font-semibold text-gold">Tap to call</p>
            </a>
          </div>
        </section>
      </main>

      <div className="kente-rule" />
      <footer className="bg-cream py-10 text-center">
        <div className="px-5">
          <SubscribeForm />
        </div>
        <img src={LOGO_SRC} alt="Tsholo R Fashion House" width={632} height={276} loading="lazy" className="mx-auto mt-10 h-24 w-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Style that moves with you · Dress with Purpose</p>
        <p className="mt-4 px-5 text-sm text-muted-foreground">{SHOP_CONTACT.addressLines.join(", ")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Phone & WhatsApp:{" "}
          <a href={whatsappLink(SHOP_CONTACT.phone)} target="_blank" rel="noreferrer" className="font-semibold text-gold underline-offset-4 hover:underline">{SHOP_CONTACT.phone}</a>
        </p>
        <Link to="/admin" className="mt-4 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">Owner sign in</Link>
      </footer>

      <a
        href={whatsappLink(SHOP_CONTACT.phone, "Hi Tsholo R Fashion House, I'd like to ask about")}
        target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-semibold text-gold-foreground shadow-card transition-transform hover:scale-105"
      >
        <MessageCircle className="size-5" /> <span className="hidden sm:inline">WhatsApp us</span>
      </a>

      <ProductDialog product={viewing} mainImage={viewing ? images[viewing.id] : undefined} onClose={() => setViewing(null)} onAdd={add} />

      <Sheet open={bagOpen} onOpenChange={setBagOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">
              {step === "details" ? "Your details" : step === "done" ? "Order received" : "Your bag"}
            </SheetTitle>
          </SheetHeader>

          {step === "done" && placed ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-12 text-gold" />
              <p className="mt-4 font-display text-3xl font-bold">Thank you!</p>
              <p className="mt-2 text-muted-foreground">Order #{placed.orderNumber} · {formatRand(placed.total)}</p>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">We'll contact you to confirm your order and arrange payment and delivery.</p>
              <a href={whatsappLink(SHOP_CONTACT.phone, `Hi, I just placed order #${placed.orderNumber}`)} target="_blank" rel="noreferrer" className="mt-3 text-sm font-semibold text-gold underline-offset-4 hover:underline">
                Questions? WhatsApp us on {SHOP_CONTACT.phone}
              </a>
              <Button variant="gold" className="mt-6" onClick={() => { setBagOpen(false); setStep("bag"); }}>Keep shopping</Button>
            </div>
          ) : step === "details" ? (
            <form onSubmit={submitOrder} className="flex flex-1 flex-col gap-4 overflow-y-auto px-1">
              <div className="space-y-1.5"><Label htmlFor="o-name">Full name</Label><Input id="o-name" name="name" required minLength={2} maxLength={100} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-phone">Phone (WhatsApp)</Label><Input id="o-phone" name="phone" type="tel" required minLength={7} maxLength={20} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-email">Email (optional)</Label><Input id="o-email" name="email" type="email" maxLength={255} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-address">Delivery address</Label><Textarea id="o-address" name="address" required minLength={5} maxLength={500} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-notes">Notes (fitting, colour…)</Label><Textarea id="o-notes" name="notes" maxLength={500} /></div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={news} onCheckedChange={(v) => setNews(v === true)} aria-label="Send me new collections and specials by email" />
                <span>
                  Send me new collections and specials by email
                  <span className="block text-xs text-muted-foreground">Needs your email above. We'll email you a link to confirm, and you can unsubscribe at any time.</span>
                </span>
              </label>
              <div className="mt-auto space-y-3 border-t border-border pt-4">
                <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatRand(total)}</span></div>
                <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy}>{busy ? "Placing order…" : "Place order"}</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("bag")}>Back to bag</Button>
                <p className="bg-accent p-3 text-xs text-muted-foreground">No payment is taken now — we'll confirm with you first.</p>
              </div>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto">
                {cart.length === 0 && <p className="py-10 text-center text-muted-foreground">Your bag is empty.</p>}
                {cart.map((l) => (
                  <div key={l.key} className="flex gap-3 border-b border-border pb-4">
                    {images[l.id] ? <img src={images[l.id]} alt={l.name} className="h-20 w-16 object-cover" /> : <div className="h-20 w-16 bg-muted" />}
                    <div className="flex-1">
                      <p className="font-display text-lg leading-tight">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.size ? `Size ${l.size} · ` : ""}{l.fabric}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-7" aria-label="Remove one" onClick={() => change(l.key, -1)}><Minus /></Button>
                        <span className="w-5 text-center text-sm">{l.qty}</span>
                        <Button variant="outline" size="icon" className="size-7" aria-label="Add one" onClick={() => change(l.key, 1)}><Plus /></Button>
                      </div>
                    </div>
                    <p className="font-semibold">{formatRand(l.price * l.qty)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatRand(total)}</span></div>
                <Button variant="gold" size="xl" className="w-full" disabled={!cart.length} onClick={() => setStep("details")}>Checkout</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
