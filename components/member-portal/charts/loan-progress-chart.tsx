"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { formatUGX } from "@/lib/utils"

export default function LoanProgressChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          <Cell fill="var(--success-600)" />
          <Cell fill="var(--border-strong)" />
        </Pie>
        <Tooltip
          formatter={(v) => formatUGX(Number(v))}
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
