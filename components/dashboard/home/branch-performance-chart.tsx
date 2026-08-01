"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

export default function BranchPerformanceChart({
  data,
  colors,
}: {
  data: { branch: string; members: number; loans: number }[]
  colors: string[]
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="branch" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }} />
        <Legend />
        <Bar dataKey="members" name="Members" fill={colors[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="loans" name="Loans" fill={colors[1]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
