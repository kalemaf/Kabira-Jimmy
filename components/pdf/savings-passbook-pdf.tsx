import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type PassbookProps = {
  branchName: string;
  accountNumber: string;
  memberName: string;
  memberNumber: string;
  accountType: string;
  balance: number;
  transactions: {
    type: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
    staffName: string;
  }[];
};

const ugx = (n: number) => `UGX ${n.toLocaleString("en-US")}`;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#141414", fontFamily: "Helvetica" },
  header: { marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #E7E5E1" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 10, color: "#5C5C5C" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: "#5C5C5C" },
  value: { fontWeight: 700 },
  table: { marginTop: 16 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1px solid #141414", paddingBottom: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #E7E5E1", paddingVertical: 4 },
  th: { fontSize: 9, fontWeight: 700, textTransform: "uppercase" },
  td: { fontSize: 9 },
  colDate: { width: "25%" },
  colType: { width: "20%" },
  colAmt: { width: "27.5%", textAlign: "right" },
});

export function SavingsPassbookPDF({
  branchName,
  accountNumber,
  memberName,
  memberNumber,
  accountType,
  balance,
  transactions,
}: PassbookProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Savings Passbook</Text>
          <Text style={styles.meta}>Nexcgen — {branchName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>{memberName} ({memberNumber})</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Account number</Text>
          <Text style={styles.value}>{accountNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Account type</Text>
          <Text style={styles.value}>{accountType}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Current balance</Text>
          <Text style={styles.value}>{ugx(balance)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colType]}>Type</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
            <Text style={[styles.th, styles.colAmt]}>Balance</Text>
          </View>
          {transactions.map((t, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.td, styles.colDate]}>{new Date(t.createdAt).toLocaleDateString("en-UG")}</Text>
              <Text style={[styles.td, styles.colType]}>{t.type}</Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(t.amount)}</Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(t.balanceAfter)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
