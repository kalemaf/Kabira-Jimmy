import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

type AmortizationRow = {
  period: number;
  dueDate: string;
  principal: number;
  interest: number;
  installment: number;
  closingBalance: number;
};

type LoanAgreementProps = {
  branchName: string;
  memberName: string;
  memberNumber: string;
  loanProductName: string;
  principal: number;
  interestRate: number;
  interestMethod: string;
  repaymentPeriodMonths: number;
  disbursedAt: string;
  totalPayable: number;
  monthlyInstallment: number | null;
  schedule: AmortizationRow[];
  signatureUrl?: string | null;
};

const ugx = (n: number) => `UGX ${n.toLocaleString("en-US")}`;

// design-style-guide.md §12 — PDFs render on white, palette/type scale
// adapted for print legibility, not the dark app palette.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#141414", fontFamily: "Helvetica" },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid #E7E5E1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 10, color: "#5C5C5C" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: "#5C5C5C" },
  value: { fontWeight: 700 },
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1px solid #141414",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #E7E5E1", paddingVertical: 4 },
  th: { fontSize: 9, fontWeight: 700, textTransform: "uppercase" },
  td: { fontSize: 9 },
  colPeriod: { width: "10%" },
  colDate: { width: "20%" },
  colAmt: { width: "17.5%", textAlign: "right" },
  terms: { fontSize: 9, color: "#5C5C5C", lineHeight: 1.5, marginTop: 4 },
  signatureBlock: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: { width: "45%" },
  signatureLine: { borderTop: "1px solid #141414", marginTop: 32, paddingTop: 4 },
  signatureImage: { height: 40, marginBottom: 4, objectFit: "contain" },
});

export function LoanAgreementPDF({
  branchName,
  memberName,
  memberNumber,
  loanProductName,
  principal,
  interestRate,
  interestMethod,
  repaymentPeriodMonths,
  disbursedAt,
  totalPayable,
  monthlyInstallment,
  schedule,
  signatureUrl,
}: LoanAgreementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Loan Agreement</Text>
            <Text style={styles.meta}>Nexcgen — {branchName}</Text>
          </View>
          <Text style={styles.meta}>Generated {new Date().toLocaleString("en-UG")}</Text>
        </View>

        <Text style={styles.sectionTitle}>Borrower</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{memberName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Member number</Text>
          <Text style={styles.value}>{memberNumber}</Text>
        </View>

        <Text style={styles.sectionTitle}>Loan terms</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Product</Text>
          <Text style={styles.value}>{loanProductName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Principal</Text>
          <Text style={styles.value}>{ugx(principal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Interest rate</Text>
          <Text style={styles.value}>{interestRate}% per month ({interestMethod})</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Repayment period</Text>
          <Text style={styles.value}>{repaymentPeriodMonths} months</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Disbursed</Text>
          <Text style={styles.value}>{new Date(disbursedAt).toLocaleDateString("en-UG")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total payable</Text>
          <Text style={styles.value}>{ugx(totalPayable)}</Text>
        </View>
        {monthlyInstallment ? (
          <View style={styles.row}>
            <Text style={styles.label}>Monthly instalment</Text>
            <Text style={styles.value}>{ugx(monthlyInstallment)}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Repayment schedule</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colPeriod]}>Period</Text>
            <Text style={[styles.th, styles.colDate]}>Due date</Text>
            <Text style={[styles.th, styles.colAmt]}>Principal</Text>
            <Text style={[styles.th, styles.colAmt]}>Interest</Text>
            <Text style={[styles.th, styles.colAmt]}>Instalment</Text>
            <Text style={[styles.th, styles.colAmt]}>Balance</Text>
          </View>
          {schedule.map((row) => (
            <View style={styles.tableRow} key={row.period}>
              <Text style={[styles.td, styles.colPeriod]}>{row.period}</Text>
              <Text style={[styles.td, styles.colDate]}>
                {new Date(row.dueDate).toLocaleDateString("en-UG")}
              </Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(row.principal)}</Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(row.interest)}</Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(row.installment)}</Text>
              <Text style={[styles.td, styles.colAmt]}>{ugx(row.closingBalance)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Terms &amp; conditions</Text>
        <Text style={styles.terms}>
          The borrower agrees to repay the principal and interest above according to the schedule
          set out in this agreement. Late instalments accrue a penalty per the loan product&apos;s
          penalty rate. This agreement is governed by Nexcgen&apos;s bylaws and Ugandan
          cooperative society regulations.
        </Text>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureBox}>
            {signatureUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop
              <Image src={signatureUrl} style={styles.signatureImage} />
            ) : null}
            <View style={styles.signatureLine}>
              <Text style={styles.meta}>Borrower signature</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.meta}>Nexcgen representative</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
