import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { truncatePdfCell } from './pdfText.ts';

export interface LabTestRow {
  readonly name: string;
  readonly result: string;
  readonly reference: string;
  readonly isHeader?: boolean;
}

function renderHasil(result: string) {
  const value = result || '-';
  const asteriskCount = value.length - value.replace(/\*+$/, '').length;
  if (asteriskCount === 0) {
    return value;
  }
  const base = value.slice(0, value.length - asteriskCount);
  const asterisks = value.slice(value.length - asteriskCount);
  return (
    <>
      {base}
      <Text style={{ color: RED }}>{asterisks}</Text>
    </>
  );
}

export interface LabReportData {
  readonly logoSrc: string;
  readonly regCode: string;
  readonly dokterNama: string;
  readonly tanggalPemeriksaan: string;
  readonly namaPasien: string;
  readonly umurLabel: string;
  readonly alamat: string;
  readonly labResultsText?: string;
  readonly rows?: readonly LabTestRow[];
  readonly petugasLabNama?: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';
const RED = '#dc2626';

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BLACK,
  },
  frame: {
    height: '100%',
    borderWidth: 1,
    borderColor: BLACK,
    padding: 10,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logo: {
    width: 48,
    height: 48,
    marginRight: 8,
  },
  headerText: {
    width: 400,
    paddingTop: 4,
  },
  clinicSmall: {
    fontSize: 8,
    color: BLACK,
    marginBottom: 2,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 3,
  },
  clinicAddress: {
    fontSize: 8.5,
    color: BLACK,
    lineHeight: 1.35,
  },
  divider: {
    height: 2.5,
    backgroundColor: BLUE,
    marginTop: 6,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  recipientBox: {
    width: 185,
    borderWidth: 1,
    borderColor: BLACK,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  recipientLine: {
    fontSize: 8.5,
    lineHeight: 1.5,
    color: BLACK,
    marginBottom: 2,
  },
  recipientDoctor: {
    color: BLUE,
  },
  patientTable: {
    borderWidth: 1,
    borderColor: BLACK,
    marginBottom: 8,
  },
  patientRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BLACK,
    minHeight: 22,
  },
  patientRowLast: {
    flexDirection: 'row',
    minHeight: 22,
  },
  colLabelLeft: {
    width: 75,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  colColon: {
    width: 14,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colValueLeft: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: BLACK,
  },
  colLabelRight: {
    width: 55,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  colValueRight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  colonText: {
    fontSize: 8.5,
    color: BLACK,
    textAlign: 'center',
  },
  label: {
    color: BLACK,
  },
  value: {
    color: BLUE,
  },
  title: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    textDecoration: 'underline',
    marginBottom: 6,
    color: BLACK,
  },

  /* Unified Single Full-Width Table */
  tableContainer: {
    borderWidth: 1,
    borderColor: BLACK,
    marginTop: 4,
    marginBottom: 6,
    width: '100%',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderColor: BLACK,
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  thName: { width: '45%', paddingLeft: 6, fontWeight: 'bold', fontSize: 8.5 },
  thResult: { width: '25%', textAlign: 'center', fontWeight: 'bold', fontSize: 8.5 },
  thRef: { width: '30%', textAlign: 'center', fontWeight: 'bold', fontSize: 8.5 },

  catHeaderRow: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 3,
    paddingLeft: 6,
    borderBottomWidth: 0.8,
    borderColor: BLACK,
  },
  catHeaderText: {
    fontWeight: 'bold',
    fontSize: 8.5,
    textTransform: 'uppercase',
  },

  trRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingVertical: 3.5,
    minHeight: 16,
  },
  tdName: { width: '45%', paddingLeft: 6, fontSize: 8.5 },
  tdResult: { width: '25%', textAlign: 'center', fontSize: 8.5, color: BLUE, fontWeight: 'bold' },
  tdRef: { width: '30%', textAlign: 'center', fontSize: 8 },

  notesBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BLACK,
    padding: 6,
  },
  notesTitle: {
    fontWeight: 'bold',
    fontSize: 8.5,
    marginBottom: 2,
    color: BLACK,
  },
  notesContent: {
    fontSize: 8.5,
    color: BLUE,
    lineHeight: 1.35,
  },

  signatureWrap: {
    marginTop: 'auto',
    alignItems: 'flex-end',
    paddingTop: 6,
    // Naikkan blok Divalidasi/Analis 2cm dari batas bawah halaman.
    marginBottom: 57,
  },
  signature: {
    width: 200,
    alignItems: 'center',
    fontSize: 9,
    color: BLACK,
  },
  signatureLine: {
    marginBottom: 0,
  },
  signatureGap: {
    height: 40,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: BLUE,
    textDecoration: 'underline',
  },
  signatureRole: {
    fontSize: 8,
    color: BLACK,
    marginTop: 2,
  },
});

function PatientRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  last = false,
}: {
  readonly leftLabel: string;
  readonly leftValue: string;
  readonly rightLabel: string;
  readonly rightValue: string;
  readonly last?: boolean;
}) {
  return (
    <View style={last ? styles.patientRowLast : styles.patientRow}>
      <View style={styles.colLabelLeft}>
        <Text style={[styles.cellText, styles.label]}>{leftLabel}</Text>
      </View>
      <View style={styles.colColon}>
        <Text style={styles.colonText}>:</Text>
      </View>
      <View style={styles.colValueLeft}>
        <Text style={[styles.cellText, styles.value]}>{truncatePdfCell(leftValue)}</Text>
      </View>
      <View style={styles.colLabelRight}>
        <Text style={[styles.cellText, styles.label]}>{rightLabel}</Text>
      </View>
      <View style={styles.colColon}>
        <Text style={styles.colonText}>:</Text>
      </View>
      <View style={styles.colValueRight}>
        <Text style={[styles.cellText, styles.value]}>{truncatePdfCell(rightValue)}</Text>
      </View>
    </View>
  );
}

const DEFAULT_LAB_ROWS: readonly LabTestRow[] = [
  { name: 'HEMATOLOGI', result: '', reference: '', isHeader: true },
  { name: 'Hemoglobin', result: '', reference: 'L: 13-18 P: 12-16 g/dl' },
  { name: 'Jumlah Sel Leukosit', result: '', reference: '5.000 - 10.000 /µl' },
  { name: 'Jumlah Sel Trombosit', result: '', reference: '150.000 - 450.000 /µl' },
  { name: 'Nilai Hematokrit', result: '', reference: 'L: 40-52 P: 36-48 %' },

  { name: 'KIMIA DARAH', result: '', reference: '', isHeader: true },
  { name: 'Asam Urat', result: '', reference: 'L: 3,5-7 P: 2,6-6 mg/dl' },
  { name: 'Cholesterol Total', result: '', reference: '< 200 mg/dl' },
  { name: 'Trigliserida', result: '', reference: '< 200 mg/dl' },
  { name: 'GDS / GDP', result: '', reference: '70 - 126 mg/dl' },
];

export function chunkLabRowsForPdf(
  rows: readonly LabTestRow[],
  pageSize = 32,
): readonly (readonly LabTestRow[])[] {
  if (rows.length === 0) return [[]];
  const pages: LabTestRow[][] = [];
  for (let i = 0; i < rows.length; i += pageSize) {
    pages.push(rows.slice(i, i + pageSize));
  }
  return pages;
}

export function LabReportDocument({ data }: { readonly data: LabReportData }) {
  const allRows = data.rows && data.rows.length > 0 ? data.rows : DEFAULT_LAB_ROWS;
  const pages = chunkLabRowsForPdf(allRows, 32);

  return (
    <Document title={`Hasil_Lab_${data.namaPasien.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}>
      {pages.map((pageRows, pageIdx) => {
        const isLastPage = pageIdx === pages.length - 1;
        return (
          <Page key={pageIdx} size="A4" style={styles.page}>
            <View style={styles.frame}>
              {/* Header Kop */}
              <View style={styles.headerRow}>
                {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
                <View style={styles.headerText}>
                  <Text style={styles.clinicSmall}>LABORATORIUM KLINIK</Text>
                  <Text style={styles.clinicName}>PRIMA HUSADA</Text>
                  <Text style={styles.clinicAddress}>
                    Jl Siliwangi No 2 Ruko Palapa Telp 0857-1932-5557
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />

              {/* Patient Info Table with Bordered Grid Cells and Colon Columns */}
              <View style={styles.patientTable}>
                <PatientRow
                  leftLabel="Nama Pasien"
                  leftValue={data.namaPasien}
                  rightLabel="Umur"
                  rightValue={data.umurLabel}
                />
                <PatientRow
                  leftLabel="Alamat"
                  leftValue={data.alamat}
                  rightLabel="Tanggal"
                  rightValue={data.tanggalPemeriksaan}
                />
                <PatientRow
                  leftLabel="Dokter Pengirim"
                  leftValue={data.dokterNama}
                  rightLabel="No."
                  rightValue={data.regCode}
                  last={true}
                />
              </View>

              {/* Title */}
              <Text style={styles.title}>
                {pages.length > 1
                  ? `HASIL PEMERIKSAAN LABORATORIUM (LEMBAR ${pageIdx + 1}/${pages.length})`
                  : 'HASIL PEMERIKSAAN LABORATORIUM'}
              </Text>

              {/* Unified Single Full-Width Examination Table */}
              <View style={styles.tableContainer}>
                <View style={styles.thRow}>
                  <Text style={styles.thName}>PEMERIKSAAN</Text>
                  <Text style={styles.thResult}>HASIL</Text>
                  <Text style={styles.thRef}>NILAI RUJUKAN / NORMAL</Text>
                </View>
                {pageRows.map((row, i) =>
                  row.isHeader ? (
                    <View key={`${pageIdx}-${i}`} style={styles.catHeaderRow}>
                      <Text style={styles.catHeaderText}>{row.name}</Text>
                    </View>
                  ) : (
                    <View key={`${pageIdx}-${i}`} style={styles.trRow}>
                      <Text style={styles.tdName}>{truncatePdfCell(row.name, 35)}</Text>
                      <Text style={styles.tdResult}>{renderHasil(row.result)}</Text>
                      <Text style={styles.tdRef}>{row.reference || '-'}</Text>
                    </View>
                  ),
                )}
              </View>

              {/* Notes / Clinical Findings */}
              {isLastPage && data.labResultsText ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesTitle}>Kesan & Hasil Laboratorium:</Text>
                  <Text style={styles.notesContent}>{data.labResultsText}</Text>
                </View>
              ) : null}

              {/* Signature Wrap */}
              {isLastPage ? (
                <View style={styles.signatureWrap}>
                  <View style={styles.signature}>
                    <Text style={styles.signatureLine}>Divalidasi</Text>
                    <View style={styles.signatureGap} />
                    <Text style={styles.signatureName}>
                      {data.petugasLabNama ? `( ${data.petugasLabNama} )` : '( Analis )'}
                    </Text>
                    <Text style={styles.signatureRole}>ANALIS</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
