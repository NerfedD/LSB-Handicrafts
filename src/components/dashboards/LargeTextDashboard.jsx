import {
  Boxes,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Truck,
  UserRound,
  Users,
} from "../icons";
import { DestinationTile, HeroStat } from "../shared/dashboard";
import { greeting } from "../../utils/profileFormat";
import { isAdminRole } from "../../utils/permissions";

/**
 * The large-text dashboard — screen 1c.
 *
 * THE SAME SYSTEM AT KIOSK SCALE. Not a simplified version and not a different
 * product: the same data, the same destinations, set at a size somebody can
 * read from across a workshop without leaning in. Nothing on this screen is
 * below 15px and the three numbers are 56px.
 *
 * A PER-ACCOUNT PREFERENCE, NOT A ROLE. Anybody can choose it, from their
 * profile or from the account menu, and it changes only what they see. That
 * matters: making it a role would mean an administrator deciding, on somebody
 * else's behalf, that they need bigger text — which is a conversation nobody
 * wants to have.
 *
 * "WHERE DO YOU WANT TO GO?" replaces reading down a sidebar. Six tiles, each a
 * 96px target with a 60px icon and a line saying what is behind it, so choosing
 * a destination is one large deliberate press rather than a small accurate one.
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
  onNavigate,
}) {
  const isAdmin = isAdminRole(role);
  const isProduction = role === "Production Staff";

  const destinations = [
    {
      key: "products",
      icon: <Boxes className="h-7 w-7" />,
      tone: "clay",
      label: "Products & stock",
      hint: "What we make and how many there are",
      view: "products",
    },
    {
      key: "orders",
      icon: <ClipboardList className="h-7 w-7" />,
      tone: "cobalt",
      label: "Orders",
      hint: "What customers have asked for",
      view: "orders",
    },
    {
      key: "deliveries",
      icon: <Truck className="h-7 w-7" />,
      tone: "amber",
      label: "Deliveries",
      hint: "What is going out, and where it is",
      view: "deliveries",
    },
    !isProduction && {
      key: "customers",
      icon: <UserRound className="h-7 w-7" />,
      tone: "purple",
      label: "Customers",
      hint: "Who buys from us",
      view: "customers",
    },
    !isProduction && {
      key: "suppliers",
      icon: <Handshake className="h-7 w-7" />,
      tone: "clay",
      label: "Suppliers",
      hint: "Who we buy materials from",
      view: "suppliers",
    },
    isAdmin && {
      key: "staff",
      icon: <Users className="h-7 w-7" />,
      tone: "navy",
      label: "Staff & accounts",
      hint: "Who can sign in, and what they do",
      view: "staff",
    },
    {
      key: "profile",
      icon: <LayoutDashboard className="h-7 w-7" />,
      tone: "green",
      label: "My profile",
      hint: "Your details, and how this looks",
      view: "profile",
    },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-[20px] text-muted">{greeting()},</p>
        <h2 className="pt-1 text-[40px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          {profile?.name?.split(" ")[0] || "there"}.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HeroStat
          icon={<Boxes className="h-6 w-6" />}
          tone={stock.out > 0 ? "red" : stock.low > 0 ? "amber" : "green"}
          value={stock.low + stock.out}
          label="Need making"
          hint={
            stock.low + stock.out === 0
              ? "Nothing is running low today."
              : "Products below the level you set."
          }
        />
        <HeroStat
          icon={<ClipboardList className="h-6 w-6" />}
          tone="cobalt"
          value={waiting}
          label="Orders waiting"
          hint={waiting === 0 ? "Everything is finished." : "Not finished yet."}
        />
        <HeroStat
          icon={<Truck className="h-6 w-6" />}
          tone={late > 0 ? "red" : "green"}
          value={late}
          label="Deliveries late"
          hint={late === 0 ? "Everything is on time." : "Past the day promised."}
        />
      </div>

      <div>
        <h3 className="pb-4 text-[15px] font-extrabold uppercase tracking-[0.1em] text-muted">
          Where do you want to go?
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 desk:grid-cols-3">
          {destinations.map((destination) => (
            <DestinationTile
              key={destination.key}
              icon={destination.icon}
              tone={destination.tone}
              label={destination.label}
              hint={
                destination.key === "customers"
                  ? `${customerCount} on the books`
                  : destination.key === "suppliers"
                    ? `${supplierCount} on the books`
                    : destination.key === "staff"
                      ? `${peopleCount} with accounts`
                      : destination.hint
              }
              onClick={() => onNavigate(destination.view)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
