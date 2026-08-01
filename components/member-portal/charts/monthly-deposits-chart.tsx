"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatUGX } from "@/lib/utils"

export default function MonthlyDepositsChart({ data }: { data: { month: string; deposits: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v) => formatUGX(Number(v))}
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}
        />
        <Bar dataKey="deposits" fill="var(--brand-blue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
