"use client"

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { LOAN_STATUS_COLORS } from "@/lib/chart-colors"

const STATUS_LABEL: Record<string, string> = {
  Active: "Active",
  Overdue: "Overdue",
  Defaulted: "Defaulted",
  PaidOff: "Paid",
}

// Split into its own chunk (see dashboard-client.tsx's dynamic import) —
// recharts pulls in d3 internals and is heavy enough to matter on the most
// visited page in the app, especially on mobile.
export default function LoanStatusPieChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={LOAN_STATUS_COLORS[STATUS_LABEL[entry.status]] ?? "var(--text-muted)"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
