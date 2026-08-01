"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatUGX } from "@/lib/utils"

export default function SavingsGrowthChart({ data }: { data: { month: string; balance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v) => formatUGX(Number(v))}
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}
        />
        <Area type="monotone" dataKey="balance" stroke="var(--accent-500)" fill="var(--accent-soft)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
