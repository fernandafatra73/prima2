import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface Neraca2ReportData {
  readonly logoSrc: string;
  readonly namaPerusahaan: string;
  readonly year: number;
  readonly pendapatanFormatted: string;
  readonly biayaGajiFormatted: string;
  readonly biayaAtkBahanFormatted: string;
  readonly biayaListrikFormatted: string;
  readonly biayaTelponFormatted: string;
  readonly biayaTransportFormatted: string;
  readonly biayaSewaFormatted: string;
  readonly biayaLainLainFormatted: string;
  readonly totalBiayaFormatted: string;
  readonly labaRugiFormatted: string;
  readonly tempatTandaTangan: string;
  readonly tanggalTandaTanganLabel: string;
  readonly namaPenandatangan: string;
}

const BLACK = '#1a1a1a';
const BORDER = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: BLACK,
  },
  titleSection: { textAlign: 'center', marginBottom: 16 },
  titleMain: { fontSize: 12, fontWeight: 'bold' },
  titleSub: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  titlePeriod: { fontSize: 9, marginTop: 2 },
  table: { borderWidth: 0.8, borderColor: BORDER },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingVertical: 3,
  },
  rowNoLine: { flexDirection: 'row', paddingVertical: 3 },
  cellLabel: { flex: 2, paddingHorizontal: 6 },
  cellLabelIndent: { flex: 2, paddingHorizontal: 6, paddingLeft: 20 },
  cellRp: { width: 26, textAlign: 'left', paddingHorizontal: 2 },
  cellSmallValue: { width: 90, textAlign: 'right', paddingHorizontal: 6 },
  cellValue: { flex: 1, textAlign: 'right', paddingHorizontal: 6 },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 0.8,
    borderColor: BORDER,
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  labaRow: {
    flexDirection: 'row',
    borderTopWidth: 0.8,
    borderColor: BORDER,
    paddingVertical: 5,
    fontWeight: 'bold',
    fontSize: 10.5,
  },
  signatureSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 30,
    paddingHorizontal: 6,
  },
  stampImage: { width: 68, height: 68, marginRight: 16, objectFit: 'contain' },
  signatureBox: { alignItems: 'flex-start' },
  signatureDate: { fontSize: 9, marginBottom: 26 },
  signatureName: { fontSize: 9, fontWeight: 'bold' },
});

export function Neraca2ReportDocument({ data }: { readonly data: Neraca2ReportData }) {
  const isPositive = !data.labaRugiFormatted.trim().startsWith('-');

  return (
    <Document title={`Laporan_Rugi_Laba_${data.year}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleSection}>
          <Text style={styles.titleMain}>LAPORAN RUGI LABA</Text>
          <Text style={styles.titleSub}>{data.namaPerusahaan}</Text>
          <Text style={styles.titlePeriod}>PER 31 DESEMBER {data.year}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>i. Pendapatan</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellValue}>{data.pendapatanFormatted}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>ii Biaya Biaya</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellValue}>{data.totalBiayaFormatted}</Text>
          </View>

          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya gaji</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaGajiFormatted}</Text>
          </View>
          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya ATK(Bahan)</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaAtkBahanFormatted}</Text>
          </View>
          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya listrik</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaListrikFormatted}</Text>
          </View>
          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya telpon</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaTelponFormatted}</Text>
          </View>
          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya Transport</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaTransportFormatted}</Text>
          </View>
          <View style={styles.rowNoLine}>
            <Text style={styles.cellLabelIndent}>Biaya sewa</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaSewaFormatted}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabelIndent}>Biaya dan lain lain</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellSmallValue}>{data.biayaLainLainFormatted}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.cellLabel}>Total Biaya</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellValue}>{data.totalBiayaFormatted}</Text>
          </View>

          <View style={[styles.labaRow, { color: isPositive ? '#15803d' : '#b91c1c' }]}>
            <Text style={styles.cellLabel}>III. Laba(rugi)</Text>
            <Text style={styles.cellRp}>Rp</Text>
            <Text style={styles.cellValue}>{data.labaRugiFormatted}</Text>
          </View>
        </View>

        <View style={styles.signatureSection}>
          {data.logoSrc ? <Image style={styles.stampImage} src={data.logoSrc} /> : null}
          <View style={styles.signatureBox}>
            <Text style={styles.signatureDate}>
              {data.tempatTandaTangan}, {data.tanggalTandaTanganLabel}
            </Text>
            <Text style={styles.signatureName}>
              {data.namaPenandatangan ? data.namaPenandatangan : '( ................................. )'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
