import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatUGX } from "@/lib/utils";

type MemberRow = {
  memberNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  branch: { name: string } | null;
  status: string;
  savingsBalance?: number;
  activeLoan?: { outstandingBalance: number; label: string } | null;
};

// PDF palette/typography — design-style-guide.md §12. Renders on white,
// not the dark app palette, per the documented print-legibility rule.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#141414", fontFamily: "Helvetica" },
  header: { marginBottom: 24, borderBottom: "1px solid #E7E5E1", paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 10, color: "#5C5C5C" },
  table: { display: "flex", flexDirection: "column" },
  row: { flexDirection: "row", borderBottom: "1px solid #E7E5E1", paddingVertical: 6 },
  headerRow: {
    flexDirection: "row",
    borderBottom: "1px solid #141414",
    paddingBottom: 6,
    marginBottom: 2,
  },
  headerCell: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  cell: { fontSize: 9 },
  colNumber: { width: "12%" },
  colName: { width: "19%" },
  colPhone: { width: "14%" },
  colBranch: { width: "14%" },
  colSavings: { width: "14%" },
  colLoan: { width: "14%" },
  colStatus: { width: "13%" },
});

export function MemberListPDF({ members }: { members: MemberRow[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Nexcgen — Member List</Text>
          <Text style={styles.meta}>Generated {new Date().toLocaleString("en-UG")}</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.colNumber]}>Member #</Text>
            <Text style={[styles.headerCell, styles.colName]}>Name</Text>
            <Text style={[styles.headerCell, styles.colPhone]}>Phone</Text>
            <Text style={[styles.headerCell, styles.colBranch]}>Branch</Text>
            <Text style={[styles.headerCell, styles.colSavings]}>Savings</Text>
            <Text style={[styles.headerCell, styles.colLoan]}>Loan Bal.</Text>
            <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
          </View>
          {members.map((m) => (
            <View style={styles.row} key={m.memberNumber}>
              <Text style={[styles.cell, styles.colNumber]}>{m.memberNumber}</Text>
              <Text style={[styles.cell, styles.colName]}>
                {m.firstName} {m.lastName}
              </Text>
              <Text style={[styles.cell, styles.colPhone]}>{m.phone}</Text>
              <Text style={[styles.cell, styles.colBranch]}>{m.branch?.name ?? "—"}</Text>
              <Text style={[styles.cell, styles.colSavings]}>{formatUGX(m.savingsBalance ?? 0)}</Text>
              <Text style={[styles.cell, styles.colLoan]}>{formatUGX(m.activeLoan?.outstandingBalance ?? 0)}</Text>
              <Text style={[styles.cell, styles.colStatus]}>{m.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
