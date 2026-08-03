import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface Neraca1ReportData {
  readonly logoSrc: string;
  readonly namaPerusahaan: string;
  readonly year: number;
  readonly kasFormatted: string;
  readonly bankFormatted: string;
  readonly piutangFormatted: string;
  readonly persediaanFormatted: string;
  readonly totalAktivaLancarFormatted: string;
  readonly tanahFormatted: string;
  readonly gedungFormatted: string;
  readonly peralatanFormatted: string;
  readonly kendaraanFormatted: string;
  readonly totalAktivaTetapFormatted: string;
  readonly totalAktivaFormatted: string;
  readonly utangUsahaFormatted: string;
  readonly utangPajakFormatted: string;
  readonly utangLainnyaFormatted: string;
  readonly totalUtangJangkaPendekFormatted: string;
  readonly utangJangkaPanjangFormatted: string;
  readonly modalUsahaFormatted: string;
  readonly labaRugiFormatted: string;
  readonly totalModalFormatted: string;
  readonly totalPasivaFormatted: string;
  readonly tempatTandaTangan: string;
  readonly tanggalTandaTanganLabel: string;
  readonly namaPenandatangan: string;
}

const BLACK = '#1a1a1a';
const BORDER = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 22,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BLACK,
  },
  titleSection: { textAlign: 'center', marginBottom: 10 },
  titleMain: { fontSize: 12, fontWeight: 'bold' },
  titleSub: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  titlePeriod: { fontSize: 9, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    borderWidth: 0.8,
    borderColor: BORDER,
  },
  col: { flex: 1 },
  colHeaderRow: { flexDirection: 'row', borderBottomWidth: 0.8, borderColor: BORDER },
  colHeader: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 9.5,
    paddingVertical: 4,
    borderRightWidth: 0.8,
    borderColor: BORDER,
  },
  colHeaderLast: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 9.5,
    paddingVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    borderRightWidth: 0.8,
    borderColor: BORDER,
    borderBottomWidth: 0.5,
  },
  sectionHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 8.5,
    padding: 3,
  },
  dataRow: {
    flexDirection: 'row',
    borderRightWidth: 0.8,
    borderColor: BORDER,
  },
  labelCell: {
    flex: 1.4,
    fontSize: 8.5,
    padding: 3,
  },
  valueCell: {
    flex: 1,
    fontSize: 8.5,
    padding: 3,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    borderRightWidth: 0.8,
    borderTopWidth: 0.5,
    borderColor: BORDER,
  },
  totalLabelCell: {
    flex: 1.4,
    fontSize: 8.5,
    fontWeight: 'bold',
    padding: 3,
  },
  totalValueCell: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: 'bold',
    padding: 3,
    textAlign: 'right',
  },
  blankRow: {
    flexDirection: 'row',
    borderRightWidth: 0.8,
    borderColor: BORDER,
    height: 10,
  },
  finalTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 0.8,
    borderColor: BORDER,
  },
  finalTotalLabel: {
    flex: 1.4,
    fontSize: 9,
    fontWeight: 'bold',
    padding: 4,
    borderRightWidth: 0.8,
    borderColor: BORDER,
  },
  finalTotalValue: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    padding: 4,
    textAlign: 'right',
    borderRightWidth: 0.8,
    borderColor: BORDER,
  },
  signatureSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 26,
    paddingHorizontal: 6,
  },
  stampImage: { width: 68, height: 68, marginRight: 16, objectFit: 'contain' },
  signatureBox: { alignItems: 'flex-start' },
  signatureDate: { fontSize: 9, marginBottom: 26 },
  signatureName: { fontSize: 9, fontWeight: 'bold' },
});

function Row({ label, value, bold = false }: { readonly label: string; readonly value: string; readonly bold?: boolean }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.labelCell}>{label}</Text>
      <Text style={[styles.valueCell, bold ? { fontWeight: 'bold' } : {}]}>{value}</Text>
    </View>
  );
}

function Total({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabelCell}>{label}</Text>
      <Text style={styles.totalValueCell}>{value}</Text>
    </View>
  );
}

function SectionHeader({ label }: { readonly label: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderCell}>{label}</Text>
    </View>
  );
}

function Blank() {
  return <View style={styles.blankRow} />;
}

export function Neraca1ReportDocument({ data }: { readonly data: Neraca1ReportData }) {
  return (
    <Document title={`Neraca_${data.year}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleSection}>
          <Text style={styles.titleMain}>NERACA</Text>
          <Text style={styles.titleSub}>{data.namaPerusahaan}</Text>
          <Text style={styles.titlePeriod}>PER 31 DESEMBER {data.year}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <View style={styles.colHeaderRow}>
              <Text style={styles.colHeader}>AKTIVA</Text>
            </View>

            <SectionHeader label="I. AKTIVA LANCAR" />
            <Row label="KAS" value={data.kasFormatted} />
            <Row label="BANK" value={data.bankFormatted} />
            <Row label="PIUTANG" value={data.piutangFormatted} />
            <Row label="PERSEDIAAN" value={data.persediaanFormatted} />
            <Total label="TOTAL" value={data.totalAktivaLancarFormatted} />
            <Blank />

            <SectionHeader label="II. AKTIVA LANCAR" />
            <Row label="TANAH" value={data.tanahFormatted} />
            <Row label="GEDUNG" value={data.gedungFormatted} />
            <Row label="PERALATAN" value={data.peralatanFormatted} />
            <Row label="KENDARAAN" value={data.kendaraanFormatted} />
            <Total label="TOTAL" value={data.totalAktivaTetapFormatted} />

            <SectionHeader label="III. AKTIVA LANCAR LAINNYA" />
            <Row label="----------" value="" />
            <Row label="----------" value="" />
            <Row label="----------" value="" />
            <Total label="TOTAL" value={data.totalAktivaFormatted} />

            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalLabel}>TOTAL AKTIVA</Text>
              <Text style={styles.finalTotalValue}>{data.totalAktivaFormatted}</Text>
            </View>
          </View>

          <View style={styles.col}>
            <View style={styles.colHeaderRow}>
              <Text style={styles.colHeaderLast}>PASIVA</Text>
            </View>

            <SectionHeader label="IV. UTANG JANGKA PENDEK" />
            <Row label="UTANG USAHA" value={data.utangUsahaFormatted} />
            <Row label="UTANG PAJAK" value={data.utangPajakFormatted} />
            <Row label="UTANG LAINNYA" value={data.utangLainnyaFormatted} />
            <Total label="TOTAL" value={data.totalUtangJangkaPendekFormatted} />
            <Blank />

            <SectionHeader label="V. UTANG JANGKA PANJANG" />
            <Row label="UTANG JANGKA PANJANG" value={data.utangJangkaPanjangFormatted} />
            <Total label="TOTAL" value={data.utangJangkaPanjangFormatted} />
            <Blank />

            <SectionHeader label="VI. MODAL DAN LABA" />
            <Blank />
            <Row label="MODAL USAHA" value={data.modalUsahaFormatted} />
            <Row label="LABA BERJALAN" value={data.labaRugiFormatted} />
            <Total label="TOTAL MODAL" value={data.totalModalFormatted} />

            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalLabel}>TOTAL PASIVA</Text>
              <Text style={styles.finalTotalValue}>{data.totalPasivaFormatted}</Text>
            </View>
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
