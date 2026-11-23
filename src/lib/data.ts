// Demo data for a fictional mobile operator, Northline Mobile.
// Every name, number and record here is invented.

import type { SourceRecord } from "./types";

export interface Customer {
  id: string;
  name: string;
  phone: string; // masked
  planId: string;
  since: string;
  homeArea: string;
  addOns: string[];
  note: string;
}

export const CUSTOMERS: Customer[] = [
  {
    id: "C-1001",
    name: "Olena Kovalenko",
    phone: "+380 67 ••• •• 45",
    planId: "PLN-SMART-250",
    since: "2019",
    homeArea: "Lviv, centre",
    addOns: [],
    note: "Calling about a higher October bill.",
  },
  {
    id: "C-1002",
    name: "Andrii Melnyk",
    phone: "+380 50 ••• •• 18",
    planId: "PLN-UNL-450",
    since: "2021",
    homeArea: "Rivne, north district",
    addOns: [],
    note: "Says he had no network for three days.",
  },
  {
    id: "C-1003",
    name: "Iryna Bondar",
    phone: "+380 63 ••• •• 07",
    planId: "PLN-MAX-600",
    since: "2017",
    homeArea: "Kyiv, Podil",
    addOns: ["Family share (second SIM)"],
    note: "Wants a cheaper plan.",
  },
];

export const PLANS: Record<
  string,
  { name: string; fee: number; data: string; minutes: string }
> = {
  "PLN-LIGHT-150": {
    name: "Light 150",
    fee: 150,
    data: "8 GB",
    minutes: "150 min to other networks",
  },
  "PLN-SMART-250": {
    name: "Smart 250",
    fee: 250,
    data: "25 GB",
    minutes: "300 min to other networks",
  },
  "PLN-UNL-450": {
    name: "Unlimited 450",
    fee: 450,
    data: "Unlimited",
    minutes: "Unlimited",
  },
  "PLN-MAX-600": {
    name: "Max 600",
    fee: 600,
    data: "100 GB",
    minutes: "Unlimited",
  },
};

export const PACKS: Record<
  string,
  { name: string; price: number; detail: string }
> = {
  "PCK-EU7": { name: "EU Travel 7", price: 120, detail: "5 GB, 7 days, EU" },
  "PCK-EU30": {
    name: "EU Travel 30",
    price: 290,
    detail: "15 GB, 30 days, EU",
  },
};

const uah = (n: number) => `₴${n.toLocaleString("en-GB")}`;

export const RECORDS: SourceRecord[] = [
  // ── Olena: roaming bill ─────────────────────────────────────
  {
    id: "INV-1001-2026-09",
    kind: "invoice",
    title: "Invoice, September 2026",
    customerId: "C-1001",
    date: "2026-10-01",
    fields: [
      ["Period", "1–30 Sep 2026"],
      ["Total", uah(250)],
      ["Status", "Paid"],
    ],
    lines: [{ id: "L1", label: "Smart 250, monthly fee", value: uah(250) }],
  },
  {
    id: "INV-1001-2026-10",
    kind: "invoice",
    title: "Invoice, October 2026",
    customerId: "C-1001",
    date: "2026-11-01",
    fields: [
      ["Period", "1–31 Oct 2026"],
      ["Total", uah(430)],
      ["Status", "Due 15 Nov 2026"],
    ],
    lines: [
      { id: "L1", label: "Smart 250, monthly fee", value: uah(250) },
      {
        id: "L2",
        label: "Roaming data, Poland, pay-as-you-go, 1.2 GB × ₴150",
        value: uah(180),
      },
    ],
  },
  {
    id: "USG-1001-R10",
    kind: "usage",
    title: "Roaming data usage, October 2026",
    customerId: "C-1001",
    fields: [
      ["Country", "Poland (EU zone)"],
      ["Dates", "12–15 Oct 2026"],
      ["Volume", "1.2 GB"],
      ["Roaming pack active", "No"],
      ["Tariff applied", "Pay-as-you-go, ₴150 per GB"],
    ],
  },
  {
    id: "SMS-1001-1012",
    kind: "sms",
    title: "Roaming welcome SMS",
    customerId: "C-1001",
    date: "2026-10-12 08:14",
    fields: [
      ["Sent", "12 Oct 2026, 08:14"],
      ["Delivered", "Yes"],
    ],
    body: "Welcome to Poland. Data costs ₴150 per GB. Add EU Travel 7 (5 GB, ₴120): dial *150#.",
  },
  // ── Andrii: outage ──────────────────────────────────────────
  {
    id: "INC-2026-1103",
    kind: "incident",
    title: "Network outage, Rivne north district",
    date: "2026-11-03",
    fields: [
      ["Area", "Rivne, north district"],
      ["Started", "3 Nov 2026, 06:00"],
      ["Resolved", "6 Nov 2026, 14:00"],
      ["Duration", "80 hours (3 full days)"],
      ["Cause", "Power loss at two base stations"],
    ],
  },
  {
    id: "INV-1002-2026-10",
    kind: "invoice",
    title: "Invoice, October 2026",
    customerId: "C-1002",
    date: "2026-11-01",
    fields: [
      ["Period", "1–31 Oct 2026"],
      ["Total", uah(450)],
      ["Status", "Paid"],
    ],
    lines: [{ id: "L1", label: "Unlimited 450, monthly fee", value: uah(450) }],
  },
  // ── Iryna: plan fit ─────────────────────────────────────────
  {
    id: "USG-1003-Q3",
    kind: "usage",
    title: "Usage, August–October 2026",
    customerId: "C-1003",
    fields: [
      ["Data, main SIM", "6.2 GB · 4.8 GB · 5.5 GB"],
      ["Data, second SIM (Family share)", "2.3 GB · 1.9 GB · 2.1 GB"],
      ["Calls to other networks", "190 · 230 · 210 min"],
      ["Highest month, both SIMs", "8.5 GB"],
    ],
  },
  {
    id: "INV-1003-2026-10",
    kind: "invoice",
    title: "Invoice, October 2026",
    customerId: "C-1003",
    date: "2026-11-01",
    fields: [
      ["Period", "1–31 Oct 2026"],
      ["Total", uah(600)],
      ["Status", "Paid"],
    ],
    lines: [
      { id: "L1", label: "Max 600, monthly fee", value: uah(600) },
      { id: "L2", label: "Family share, second SIM", value: "Included" },
    ],
  },
  // ── Policies ────────────────────────────────────────────────
  {
    id: "POL-ROAM-02",
    kind: "policy",
    title: "Roaming charges, EU zone",
    fields: [["Updated", "1 Jun 2026"]],
    lines: [
      {
        id: "§1",
        label: "Pay-as-you-go",
        value: "Data without a pack costs ₴150 per GB.",
      },
      {
        id: "§2",
        label: "Notice",
        value: "A welcome SMS with prices is sent on first data use abroad.",
      },
      {
        id: "§3",
        label: "Packs",
        value:
          "EU Travel 7: 5 GB, 7 days, ₴120. EU Travel 30: 15 GB, 30 days, ₴290.",
      },
    ],
  },
  {
    id: "POL-GOODWILL-01",
    kind: "policy",
    title: "Goodwill credits",
    fields: [["Updated", "1 Mar 2026"]],
    lines: [
      {
        id: "§1",
        label: "First roaming bill",
        value:
          "If a customer's first roaming charge exceeds their plan fee by surprise, a one-off credit of up to 50% of that charge may be applied, capped at ₴100.",
      },
      {
        id: "§2",
        label: "Frequency",
        value: "Once per customer per 12 months.",
      },
    ],
  },
  {
    id: "POL-OUTAGE-01",
    kind: "policy",
    title: "Compensation for network outages",
    fields: [["Updated", "1 Jan 2026"]],
    lines: [
      {
        id: "§1",
        label: "Eligibility",
        value:
          "Customers whose home area had a confirmed outage longer than 48 hours.",
      },
      {
        id: "§2",
        label: "Amount",
        value:
          "Credit of one thirtieth of the monthly fee for each full day of outage.",
      },
    ],
  },
  {
    id: "POL-PLAN-03",
    kind: "policy",
    title: "Plan changes",
    fields: [["Updated", "1 Jan 2026"]],
    lines: [
      {
        id: "§1",
        label: "Timing",
        value:
          "A new plan starts on the first day of the next billing cycle. No fee.",
      },
      {
        id: "§2",
        label: "Family share",
        value:
          "Family share is available on Max 600 only. Moving to another plan ends it, and the second SIM switches to Light 150 at full price.",
      },
    ],
  },
];

export const recordById = (id: string) =>
  RECORDS.find((r) => r.id === id) ?? planRecord(id) ?? customerRecord(id);

function planRecord(id: string): SourceRecord | undefined {
  const p = PLANS[id];
  if (!p) return undefined;
  return {
    id,
    kind: "plan",
    title: `Plan: ${p.name}`,
    fields: [
      ["Monthly fee", uah(p.fee)],
      ["Data", p.data],
      ["Calls", p.minutes],
    ],
  };
}

function customerRecord(id: string): SourceRecord | undefined {
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) return undefined;
  return {
    id,
    kind: "customer",
    title: c.name,
    customerId: c.id,
    fields: [
      ["Plan", PLANS[c.planId]?.name ?? c.planId],
      ["Customer since", c.since],
      ["Home area", c.homeArea],
      ["Add-ons", c.addOns.join(", ") || "None"],
    ],
  };
}

export { uah };
