import { CaretRight, Factory, Hammer, Package, Plus, Receipt, SquaresFour, Storefront, Truck, User, Users } from "../icons";
import { Button } from "@/components/ui/button";
import { Mono } from "../shared/Chip";
import { EmptyState, Page, PageHeader, SectionCard } from "../shared/page";
import StatusPill from "../shared/StatusPill";
import { greeting } from "../../utils/profileFormat";
import { isAdminRole } from "../../utils/permissions";

/**
 * The large-text dashboard: the person's own choice on Your profile, for
 * whoever reads the screen from further away. Not on the boards; built from
 * the dashboard's parts (PageHeader, stat cards, section cards, rows) one
 * size up: 16px body, 30px figures, 36px controls.
 */
export default function LargeTextDashboard({
  profile,
  stock,
  waiting,
  late,
  peopleCount,
  customerCount,
  supplierCount,
  role,
  makeList = [],
  onNavigate,
  onRecordMade,
}) {
  const isAdmin = isAdminRole(role);
  const isProduction = role === "Production Staff";
  const topOfList = makeList.slice(0, 5);

  const destinations = [
    { key: "products", icon: Package, label: "Inventory", hint: "What we make and how many there are", view: "products" },
    { key: "orders", icon: Receipt, label: "Orders", hint: "What customers have asked for", view: "orders" },
    { key: "deliveries", icon: Truck, label: "Deliveries", hint: "What is going out, and where it is", view: "deliveries" },
    !isProduction && { key: "customers", icon: Storefront, label: "Customers", hint: `${customerCount} on the books`, view: "customers" },
    !isProduction && { key: "suppliers", icon: Factory, label: "Suppliers", hint: `${supplierCount} on the books`, view: "suppliers" },
    isAdmin && { key: "staff", icon: Users, label: "User Management", hint: `${peopleCount} with accounts`, view: "staff" },
    { key: "profile", icon: User, label: "Your profile", hint: "Your details, and how this looks", view: "profile" },
  ].filter(Boolean);

  const stats = [
    { label: "Need making", value: stock.low + stock.out, hint: stock.low + stock.out === 0 ? "Nothing is running low today." : "Products below the level you set.", tone: stock.out ? "red" : stock.low ? "amber" : "green" },
    { label: "Orders waiting", value: waiting, hint: waiting === 0 ? "Everything is finished." : "Not finished yet.", tone: "neutral" },
    { label: "Deliveries late", value: late, hint: late === 0 ? "Everything is on time." : "Past the day promised.", tone: late ? "red" : "green" },
  ];

  return (
    <Page className="text-base">
      <PageHeader
        icon={SquaresFour}
        title="Dashboard"
        description={`${greeting()}, ${profile?.name?.split(" ")[0] || "there"}. This is the large-text view; change it on Your profile.`}
      />

      <section aria-label="Key numbers" className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-xs">
            <span className="text-base font-medium text-muted-fg">{stat.label}</span>
            <span className="text-[30px] font-semibold leading-9 tracking-[-0.02em]">{stat.value}</span>
            <span className="flex items-center gap-2 text-sm text-muted-fg">
              <StatusPill label={stat.tone === "green" ? "Fine" : stat.tone === "neutral" ? "Today" : "Look"} tone={stat.tone} />
              {stat.hint}
            </span>
          </div>
        ))}
      </section>

      {isProduction ? (
        <SectionCard
          title={<span className="text-base">Needed next, most urgent first</span>}
          footer={
            onRecordMade ? (
              <Button size="lg" onClick={() => onRecordMade()}>
                <Plus aria-hidden="true" />
                Start batch
              </Button>
            ) : null
          }
        >
          {topOfList.length === 0 ? (
            <div className="border-t border-border">
              <EmptyState icon={Hammer} title="Nothing to make" description="Nothing is running low. The shelves are where they should be." />
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {topOfList.map(({ product, onShelf, needed, urgency, tone, backorder }) => (
                <li key={`${backorder ? "owed" : "low"}-${product.id}`} className="flex flex-wrap items-center gap-4 border-t border-row-divider px-4 py-3.5">
                  <div className="min-w-[220px] flex-1">
                    <p className="m-0 text-base font-medium">{product.name}</p>
                    {backorder ? (
                      <p className="m-0 text-sm font-medium text-danger-fg">Somebody is already waiting for this</p>
                    ) : (
                      <p className="m-0 text-sm text-muted-fg">
                        {onShelf} on the shelf, need {needed} more · <Mono>{product.itemCode}</Mono>
                      </p>
                    )}
                  </div>
                  <StatusPill label={urgency} tone={tone} />
                  <Button variant="outline" size="lg" onClick={() => onRecordMade(product.id, needed * (product.packSize || 1))}>
                    Start batch
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title={<span className="text-base">Where do you want to go?</span>}>
        <ul className="m-0 grid list-none gap-px border-t border-row-divider bg-row-divider p-0 sm:grid-cols-2 xl:grid-cols-3">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <li key={destination.key} className="bg-card">
                <button
                  type="button"
                  onClick={() => onNavigate(destination.view)}
                  className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-4 text-left hover:bg-surface-2"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-fg-2 shadow-xs">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">{destination.label}</span>
                    <span className="block text-sm text-muted-fg">{destination.hint}</span>
                  </span>
                  <CaretRight className="size-4 text-muted-fg" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </Page>
  );
}
