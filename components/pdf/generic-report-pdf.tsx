import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportColumn, ReportRow } from "@/lib/reports";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#141414", fontFamily: "Helvetica" },
  header: { marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #E7E5E1" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#5C5C5C" },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1px solid #141414", paddingBottom: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #E7E5E1", paddingVertical: 4 },
  th: { fontSize: 8, fontWeight: 700, textTransform: "uppercase" },
  td: { fontSize: 9 },
});

export function GenericReportPDF({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}) {
  const colWidth = `${100 / columns.length}%`;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Nexcgen — Generated {new Date().toLocaleString("en-UG")}</Text>
        </View>
        <View>
          <View style={styles.tableHeaderRow}>
            {columns.map((c) => (
              <Text
                key={c.key}
                style={[styles.th, { width: colWidth, textAlign: c.align === "right" ? "right" : "left" }]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View style={styles.tableRow} key={i}>
              {columns.map((c) => (
                <Text
                  key={c.key}
                  style={[styles.td, { width: colWidth, textAlign: c.align === "right" ? "right" : "left" }]}
                >
                  {String(row[c.key] ?? "")}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
