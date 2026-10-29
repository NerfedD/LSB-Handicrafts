// Central icon re-exports: Phosphor, regular weight by default.
//
// One file so a call site names an icon once and the library behind it can
// change here. Each icon is imported from its own public subpath
// (`@phosphor-icons/react/House`), not from the package barrel, so the dev
// server loads only the icons something uses.
//
// Weights: regular everywhere; `weight="fill"` only on the active nav item.
// Sizes: 16px in menus and buttons (size-4), 20px in page headers (size-5).
//
// Every name below is the Phosphor name; the boards in design/admin-dashboard
// draw these same icons by hand.

// ---- navigation ----
export { SquaresFourIcon as SquaresFour } from "@phosphor-icons/react/SquaresFour";
export { ReceiptIcon as Receipt } from "@phosphor-icons/react/Receipt";
export { PackageIcon as Package } from "@phosphor-icons/react/Package";
export { TruckIcon as Truck } from "@phosphor-icons/react/Truck";
export { HammerIcon as Hammer } from "@phosphor-icons/react/Hammer";
export { UsersIcon as Users } from "@phosphor-icons/react/Users";
export { IdentificationCardIcon as IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
export { StorefrontIcon as Storefront } from "@phosphor-icons/react/Storefront";
export { FactoryIcon as Factory } from "@phosphor-icons/react/Factory";
export { GearIcon as Gear } from "@phosphor-icons/react/Gear";
export { StackIcon as Stack } from "@phosphor-icons/react/Stack";
export { ClipboardTextIcon as ClipboardText } from "@phosphor-icons/react/ClipboardText";
export { ChartLineIcon as ChartLine } from "@phosphor-icons/react/ChartLine";
export { ClockCounterClockwiseIcon as ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
export { BellIcon as Bell } from "@phosphor-icons/react/Bell";
export { ShieldIcon as Shield } from "@phosphor-icons/react/Shield";
export { ShieldWarningIcon as ShieldWarning } from "@phosphor-icons/react/ShieldWarning";
export { UserIcon as User } from "@phosphor-icons/react/User";
export { SignOutIcon as SignOut } from "@phosphor-icons/react/SignOut";
export { SignInIcon as SignIn } from "@phosphor-icons/react/SignIn";
export { SidebarSimpleIcon as SidebarSimple } from "@phosphor-icons/react/SidebarSimple";

// ---- carets and arrows ----
export { CaretUpDownIcon as CaretUpDown } from "@phosphor-icons/react/CaretUpDown";
export { CaretRightIcon as CaretRight } from "@phosphor-icons/react/CaretRight";
export { CaretLeftIcon as CaretLeft } from "@phosphor-icons/react/CaretLeft";
export { CaretDownIcon as CaretDown } from "@phosphor-icons/react/CaretDown";
export { CaretUpIcon as CaretUp } from "@phosphor-icons/react/CaretUp";
export { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
export { ArrowRightIcon as ArrowRight } from "@phosphor-icons/react/ArrowRight";
export { ArrowClockwiseIcon as ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
export { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
export { ArrowUUpLeftIcon as ArrowUUpLeft } from "@phosphor-icons/react/ArrowUUpLeft";
export { ArrowsClockwiseIcon as ArrowsClockwise } from "@phosphor-icons/react/ArrowsClockwise";

// ---- actions ----
export { MagnifyingGlassIcon as MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
export { PlusIcon as Plus } from "@phosphor-icons/react/Plus";
export { MinusIcon as Minus } from "@phosphor-icons/react/Minus";
export { CheckIcon as Check } from "@phosphor-icons/react/Check";
export { XIcon as X } from "@phosphor-icons/react/X";
export { DownloadSimpleIcon as DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
export { PrinterIcon as Printer } from "@phosphor-icons/react/Printer";
export { PencilSimpleIcon as PencilSimple } from "@phosphor-icons/react/PencilSimple";
export { TrashIcon as Trash } from "@phosphor-icons/react/Trash";
export { DotsThreeIcon as DotsThree } from "@phosphor-icons/react/DotsThree";
export { FunnelIcon as Funnel } from "@phosphor-icons/react/Funnel";
export { FloppyDiskIcon as FloppyDisk } from "@phosphor-icons/react/FloppyDisk";
export { PaperPlaneTiltIcon as PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
export { CopyIcon as Copy } from "@phosphor-icons/react/Copy";
export { EyeIcon as Eye } from "@phosphor-icons/react/Eye";
export { EyeSlashIcon as EyeSlash } from "@phosphor-icons/react/EyeSlash";
export { LockIcon as Lock } from "@phosphor-icons/react/Lock";
export { KeyIcon as Key } from "@phosphor-icons/react/Key";
export { ProhibitIcon as Prohibit } from "@phosphor-icons/react/Prohibit";
export { CameraIcon as Camera } from "@phosphor-icons/react/Camera";
export { ImageSquareIcon as ImageSquare } from "@phosphor-icons/react/ImageSquare";

// ---- views ----
export { ListIcon as List } from "@phosphor-icons/react/List";
export { RowsIcon as Rows } from "@phosphor-icons/react/Rows";
export { KanbanIcon as Kanban } from "@phosphor-icons/react/Kanban";
export { CalendarBlankIcon as CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
export { ClockIcon as Clock } from "@phosphor-icons/react/Clock";
export { SunIcon as Sun } from "@phosphor-icons/react/Sun";
export { MoonIcon as Moon } from "@phosphor-icons/react/Moon";
export { DeviceMobileIcon as DeviceMobile } from "@phosphor-icons/react/DeviceMobile";
export { MonitorIcon as Monitor } from "@phosphor-icons/react/Monitor";
export { TextAaIcon as TextAa } from "@phosphor-icons/react/TextAa";

// ---- status ----
export { InfoIcon as Info } from "@phosphor-icons/react/Info";
export { WarningIcon as Warning } from "@phosphor-icons/react/Warning";
export { WarningCircleIcon as WarningCircle } from "@phosphor-icons/react/WarningCircle";
export { CheckCircleIcon as CheckCircle } from "@phosphor-icons/react/CheckCircle";
export { XCircleIcon as XCircle } from "@phosphor-icons/react/XCircle";
export { QuestionIcon as Question } from "@phosphor-icons/react/Question";
export { CloudSlashIcon as CloudSlash } from "@phosphor-icons/react/CloudSlash";
export { SpinnerGapIcon as SpinnerGap } from "@phosphor-icons/react/SpinnerGap";
export { TrayIcon as Tray } from "@phosphor-icons/react/Tray";

// ---- records ----
export { MoneyIcon as Money } from "@phosphor-icons/react/Money";
export { WalletIcon as Wallet } from "@phosphor-icons/react/Wallet";
export { TagIcon as Tag } from "@phosphor-icons/react/Tag";
export { GiftIcon as Gift } from "@phosphor-icons/react/Gift";
export { RepeatIcon as Repeat } from "@phosphor-icons/react/Repeat";
export { EnvelopeIcon as Envelope } from "@phosphor-icons/react/Envelope";
export { PhoneIcon as Phone } from "@phosphor-icons/react/Phone";
export { MapPinIcon as MapPin } from "@phosphor-icons/react/MapPin";
export { AtIcon as At } from "@phosphor-icons/react/At";
export { BuildingsIcon as Buildings } from "@phosphor-icons/react/Buildings";
export { UserPlusIcon as UserPlus } from "@phosphor-icons/react/UserPlus";
export { UserCheckIcon as UserCheck } from "@phosphor-icons/react/UserCheck";
export { UserMinusIcon as UserMinus } from "@phosphor-icons/react/UserMinus";
export { UserGearIcon as UserGear } from "@phosphor-icons/react/UserGear";
export { HandshakeIcon as Handshake } from "@phosphor-icons/react/Handshake";
export { AddressBookIcon as AddressBook } from "@phosphor-icons/react/AddressBook";
export { CubeIcon as Cube } from "@phosphor-icons/react/Cube";
export { CircleIcon as Circle } from "@phosphor-icons/react/Circle";
export { SquareIcon as Square } from "@phosphor-icons/react/Square";
export { ShapesIcon as Shapes } from "@phosphor-icons/react/Shapes";
export { ListChecksIcon as ListChecks } from "@phosphor-icons/react/ListChecks";
export { PulseIcon as Pulse } from "@phosphor-icons/react/Pulse";

// ---- LEGACY-NAMES: the previous icon set's names, pointed at their Phosphor
// equivalents, for screens not yet rebuilt. Removed in the last phase. ----
export { SquaresFourIcon as LayoutDashboard } from "@phosphor-icons/react/SquaresFour";
export { PlusIcon as PackagePlus } from "@phosphor-icons/react/Plus";
export { PackageIcon as PackageCheck } from "@phosphor-icons/react/Package";
export { PackageIcon as PackageOpen } from "@phosphor-icons/react/Package";
export { PackageIcon as PackageX } from "@phosphor-icons/react/Package";
export { ReceiptIcon as ShoppingCart } from "@phosphor-icons/react/Receipt";
export { UserIcon as UserRound } from "@phosphor-icons/react/User";
export { UserMinusIcon as UserX } from "@phosphor-icons/react/UserMinus";
export { UserGearIcon as UserCog } from "@phosphor-icons/react/UserGear";
export { AddressBookIcon as BookUser } from "@phosphor-icons/react/AddressBook";
export { ClipboardTextIcon as ClipboardList } from "@phosphor-icons/react/ClipboardText";
export { ClipboardTextIcon as ClipboardCheck } from "@phosphor-icons/react/ClipboardText";
export { StackIcon as Layers } from "@phosphor-icons/react/Stack";
export { CubeIcon as Boxes } from "@phosphor-icons/react/Cube";
export { CubeIcon as Box } from "@phosphor-icons/react/Cube";
export { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/MagnifyingGlass";
export { FunnelIcon as Filter } from "@phosphor-icons/react/Funnel";
export { CaretDownIcon as ChevronDown } from "@phosphor-icons/react/CaretDown";
export { CaretUpIcon as ChevronUp } from "@phosphor-icons/react/CaretUp";
export { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/EyeSlash";
export { PencilSimpleIcon as Pencil } from "@phosphor-icons/react/PencilSimple";
export { TrashIcon as Trash2 } from "@phosphor-icons/react/Trash";
export { DotsThreeIcon as MoreHorizontal } from "@phosphor-icons/react/DotsThree";
export { CheckCircleIcon as CircleCheck } from "@phosphor-icons/react/CheckCircle";
export { XCircleIcon as CircleX } from "@phosphor-icons/react/XCircle";
export { WarningCircleIcon as CircleAlert } from "@phosphor-icons/react/WarningCircle";
export { QuestionIcon as CircleHelp } from "@phosphor-icons/react/Question";
export { WarningIcon as TriangleAlert } from "@phosphor-icons/react/Warning";
export { ShieldWarningIcon as ShieldAlert } from "@phosphor-icons/react/ShieldWarning";
export { CloudSlashIcon as CloudOff } from "@phosphor-icons/react/CloudSlash";
export { SpinnerGapIcon as LoaderCircle } from "@phosphor-icons/react/SpinnerGap";
export { EnvelopeIcon as Mail } from "@phosphor-icons/react/Envelope";
export { AtIcon as AtSign } from "@phosphor-icons/react/At";
export { KeyIcon as KeyRound } from "@phosphor-icons/react/Key";
export { SignInIcon as LogIn } from "@phosphor-icons/react/SignIn";
export { SignOutIcon as LogOut } from "@phosphor-icons/react/SignOut";
export { BuildingsIcon as Building2 } from "@phosphor-icons/react/Buildings";
export { CalendarBlankIcon as Calendar } from "@phosphor-icons/react/CalendarBlank";
export { CalendarBlankIcon as CalendarClock } from "@phosphor-icons/react/CalendarBlank";
export { ClockCounterClockwiseIcon as History } from "@phosphor-icons/react/ClockCounterClockwise";
export { MoneyIcon as Banknote } from "@phosphor-icons/react/Money";
export { FloppyDiskIcon as Save } from "@phosphor-icons/react/FloppyDisk";
export { DownloadSimpleIcon as Download } from "@phosphor-icons/react/DownloadSimple";
export { ArrowUUpLeftIcon as Undo2 } from "@phosphor-icons/react/ArrowUUpLeft";
export { ArrowClockwiseIcon as RotateCw } from "@phosphor-icons/react/ArrowClockwise";
export { ImageSquareIcon as ImagePlus } from "@phosphor-icons/react/ImageSquare";
export { GearIcon as Settings } from "@phosphor-icons/react/Gear";
export { TrayIcon as Inbox } from "@phosphor-icons/react/Tray";
export { PaperPlaneTiltIcon as Send } from "@phosphor-icons/react/PaperPlaneTilt";
export { TextAaIcon as ALargeSmall } from "@phosphor-icons/react/TextAa";
export { PulseIcon as Activity } from "@phosphor-icons/react/Pulse";
export { ArrowUUpLeftIcon as ArchiveRestore } from "@phosphor-icons/react/ArrowUUpLeft";
