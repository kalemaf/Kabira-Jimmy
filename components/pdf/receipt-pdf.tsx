import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type ReceiptProps = {
  branchName: string;
  receiptNumber: string;
  memberName: string;
  memberNumber: string;
  amountPaid: number;
  principalPortion: number;
  interestPortion: number;
  penaltyPortion: number;
  method: string;
  collectorName: string;
  paidAt: string;
  outstandingBalance: number;
};

const ugx = (n: number) => `UGX ${n.toLocaleString("en-US")}`;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#141414", fontFamily: "Helvetica" },
  header: { marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #E7E5E1" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 10, color: "#5C5C5C" },
  amountBox: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F4F4F3",
    borderRadius: 8,
    alignItems: "center",
  },
  amountLabel: { fontSize: 9, color: "#5C5C5C", textTransform: "uppercase", letterSpacing: 0.5 },
  amountValue: { fontSize: 28, fontWeight: 700, marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottom: "1px solid #E7E5E1" },
  label: { color: "#5C5C5C" },
  value: { fontWeight: 700 },
  footer: { marginTop: 32, fontSize: 9, color: "#9A9A9A", textAlign: "center" },
});

export function ReceiptPDF({
  branchName,
  receiptNumber,
  memberName,
  memberNumber,
  amountPaid,
  principalPortion,
  interestPortion,
  penaltyPortion,
  method,
  collectorName,
  paidAt,
  outstandingBalance,
}: ReceiptProps) {
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment Receipt</Text>
          <Text style={styles.meta}>Nexcgen — {branchName}</Text>
          <Text style={styles.meta}>Receipt #{receiptNumber}</Text>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount received</Text>
          <Text style={styles.amountValue}>{ugx(amountPaid)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>{memberName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Member number</Text>
          <Text style={styles.value}>{memberNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Principal</Text>
          <Text style={styles.value}>{ugx(principalPortion)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Interest</Text>
          <Text style={styles.value}>{ugx(interestPortion)}</Text>
        </View>
        {penaltyPortion > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Penalty</Text>
            <Text style={styles.value}>{ugx(penaltyPortion)}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Payment method</Text>
          <Text style={styles.value}>{method}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Collected by</Text>
          <Text style={styles.value}>{collectorName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{new Date(paidAt).toLocaleString("en-UG")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Remaining balance</Text>
          <Text style={styles.value}>{ugx(outstandingBalance)}</Text>
        </View>

        <Text style={styles.footer}>Thank you for banking with Nexcgen.</Text>
      </Page>
    </Document>
  );
}
