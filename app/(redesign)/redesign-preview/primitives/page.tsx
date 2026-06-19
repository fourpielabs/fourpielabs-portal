"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Button,
  EmberButton,
  Segmented,
  Input,
  Textarea,
  Label,
  Field,
  Select,
  Checkbox,
  Switch,
  Badge,
  CounterBadge,
  ProgressBar,
  Skeleton,
  SkeletonItem,
  Divider,
  Spinner,
  Tooltip,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  TabList,
  Tab,
  Avatar,
  Card,
  tokens,
  StatusPill,
  DeltaChip,
  Shell,
  AmbientField,
  Measure,
  Eyebrow,
} from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Eyebrow tone="muted">{title}</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>{children}</div>
    </Card>
  );
}

export default function PrimitiveHarness() {
  const { mode } = useRedesignMode();
  const [seg, setSeg] = React.useState("month");
  const [sw, setSw] = React.useState(true);
  const [tab, setTab] = React.useState<string>("overview");

  return (
    <Shell>
      <AmbientField mode={mode} />
      <Measure width="standard" style={{ position: "relative", zIndex: 1, paddingBlock: "clamp(2rem,6vh,4rem)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Eyebrow>4Pie Labs — R1 primitives</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "2.2rem", fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
            Primitive harness
          </h1>
        </div>

        <Section title="Buttons">
          <Button appearance="primary">Primary</Button>
          <Button appearance="secondary">Secondary</Button>
          <Button appearance="outline">Outline</Button>
          <Button appearance="subtle">Subtle</Button>
          <EmberButton icon={<Plus size={16} />}>Ember CTA</EmberButton>
          <Button appearance="primary" loading>Saving</Button>
          <Button appearance="secondary" disabled>Disabled</Button>
        </Section>

        <Section title="Segmented">
          <Segmented
            ariaLabel="Range"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "quarter", label: "Quarter" },
            ]}
          />
        </Section>

        <Section title="Form (solid)">
          <Field label="Email" style={{ minWidth: 220 }}>
            <Input type="email" placeholder="you@business.com" />
          </Field>
          <Field label="Password" validationState="error" validationMessage="Enter your password" style={{ minWidth: 220 }}>
            <Input type="password" />
          </Field>
          <Field label="Program" style={{ minWidth: 180 }}>
            <Select>
              <option>Foundation</option>
              <option>Pipeline</option>
              <option>Operating System</option>
              <option>Pulse</option>
            </Select>
          </Field>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Checkbox label="Visible to client" defaultChecked />
            <Switch label="Email notifications" checked={sw} onChange={(_, d) => setSw(d.checked)} />
          </div>
          <Field label="Notes" style={{ minWidth: 240 }}>
            <Textarea placeholder="Internal note…" />
          </Field>
        </Section>

        <Section title="Status & feedback">
          <Badge appearance="filled" color="brand">Brand</Badge>
          <Badge appearance="tint" color="warning">Warning</Badge>
          <Badge appearance="tint" color="success">Success</Badge>
          <Badge appearance="outline" color="danger">Danger</Badge>
          <CounterBadge count={5} color="danger" />
          <StatusPill value="in_progress" mode={mode} />
          <StatusPill value="done" mode={mode} />
          <StatusPill value="needs_review" mode={mode} />
          <DeltaChip delta={25} mode={mode} />
          <DeltaChip delta={-8} mode={mode} />
          <Spinner size="tiny" />
          <div style={{ width: 180 }}>
            <ProgressBar value={0.62} thickness="large" color="brand" />
          </div>
        </Section>

        <Section title="Skeleton">
          <Skeleton style={{ width: 240 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonItem shape="rectangle" size={16} />
              <SkeletonItem shape="rectangle" size={16} style={{ width: "70%" }} />
            </div>
          </Skeleton>
        </Section>

        <Section title="Overlays & menus">
          <Tooltip content="Tooltip (relationship=label)" relationship="label">
            <Button appearance="secondary">Hover me</Button>
          </Tooltip>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="secondary">Menu ▾</Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem>Edit</MenuItem>
                <MenuItem>Duplicate</MenuItem>
                <MenuItem>Delete</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
          <Popover withArrow>
            <PopoverTrigger disableButtonEnhancement>
              <Button appearance="secondary">Popover</Button>
            </PopoverTrigger>
            <PopoverSurface>Arbitrary glass-allowed surface content.</PopoverSurface>
          </Popover>
          <Dialog>
            <DialogTrigger disableButtonEnhancement>
              <EmberButton>Open dialog</EmberButton>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Publish report?</DialogTitle>
                <DialogContent>This makes the report visible to the client.</DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Cancel</Button>
                  </DialogTrigger>
                  <EmberButton>Publish</EmberButton>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </Section>

        <Section title="Tabs · Avatar · Divider">
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
            <Tab value="overview">Overview</Tab>
            <Tab value="activity">Activity</Tab>
            <Tab value="files">Files</Tab>
          </TabList>
          <Divider vertical style={{ height: 28 }} />
          <Avatar name="Premier Painting" color="brand" />
          <Avatar name="Riley Partner" color="brand" badge={{ status: "available" }} />
        </Section>
      </Measure>
    </Shell>
  );
}
