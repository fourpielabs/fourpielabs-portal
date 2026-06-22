/**
 * Redesign R1 primitive layer — the ONE import point for R2/R3.
 *
 * Most Fluent v9 primitives need no wrapper: inside a FluentScope they already paint
 * the Warm Obsidian theme (amber interactive, warm neutrals, AA) with Tabster focus.
 * So this barrel re-exports the curated Fluent set + the few CUSTOM pieces (Button with
 * loading, EmberButton, Segmented) + the R0 surfaces (glass/solid, StatusPill, etc.).
 * Glass rule still applies at call sites: glass only on chrome/overlays/KPI-with-scrim;
 * forms, tables, and data render solid (these Fluent primitives are solid by default).
 */

// --- custom primitives (behavior Fluent lacks / bespoke CTA) ---
export { Button, EmberButton } from "./button";
export { Segmented, type SegmentedOption } from "./segmented";
export { BaseModal, type BaseModalProps } from "./base-modal";

// --- forms (SOLID) ---
export {
  Input,
  Textarea,
  Label,
  Field,
  Checkbox,
  Switch,
  Combobox,
  Option,
  OptionGroup,
  Radio,
  RadioGroup,
  SpinButton,
} from "@fluentui/react-components";
// themed drop-in Select (themeable open list) — replaces the native-style Fluent Select
export { Select, type SelectProps } from "./select";

// --- overlays & menus (surface may be glass; controls solid) ---
export {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  OverlayDrawer,
  InlineDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuItemLink,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Tooltip,
} from "@fluentui/react-components";

// --- data & display (SOLID) ---
export {
  Card,
  CardHeader,
  CardFooter,
  CardPreview,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableBody,
  TableCell,
  TableCellLayout,
  TabList,
  Tab,
  Avatar,
  Badge,
  CounterBadge,
  PresenceBadge,
  Skeleton,
  SkeletonItem,
  Divider,
  ProgressBar,
  Spinner,
} from "@fluentui/react-components";

// --- typography + style utils ---
export {
  Text,
  Title1,
  Title2,
  Title3,
  Subtitle1,
  Subtitle2,
  Body1,
  Body1Strong,
  Caption1,
  tokens,
  makeStyles,
  mergeClasses,
} from "@fluentui/react-components";

// --- toast (Fluent Toaster; global sonner swap deferred to R2/R3 per primitive-map) ---
export {
  Toaster,
  useToastController,
  useId,
  Toast,
  ToastTitle,
  ToastBody,
  ToastFooter,
} from "@fluentui/react-components";

// --- R0 surfaces + data bits (reused verbatim) ---
export { Shell, AmbientField, Measure, Eyebrow, GlassSurface } from "./surfaces";
export { StatusPill, DeltaChip, Progress, humanize } from "@/components/redesign/data-ui";
export {
  useRedesignMode,
  RedesignModeProvider,
  FluentScope,
  ThemeToggle,
  ThemedFluent,
} from "@/components/redesign/themed-fluent";
