import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

export interface LaporanPajakReportItem {
  readonly no: number;
  readonly bulan: string;
  readonly jumlahPasien: string;
  readonly hargaFormatted: string;
  readonly totalPenerimaanFormatted: string;
  readonly pajakFormatted: string;
}

export interface LaporanPajakReportData {
  readonly logoSrc: string;
  readonly moduleLabel: string;
  readonly year: number;
  readonly tanggalCetak: string;
  readonly items: readonly LaporanPajakReportItem[];
  readonly totalJumlahPasien: string;
  readonly totalPenerimaanFormatted: string;
  readonly totalPajakFormatted: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 18,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BLACK,
  },
  frame: {
    height: '100%',
    borderWidth: 1,
    borderColor: BLACK,
    padding: 12,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  clinicName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 2,
  },
  clinicAddress: {
    fontSize: 8,
    color: BLACK,
    lineHeight: 1.35,
  },
  divider: {
    height: 2,
    backgroundColor: BLUE,
    marginVertical: 6,
  },
  titleSection: {
    textAlign: 'center',
    marginVertical: 4,
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: BLUE,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    padding: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  infoText: {
    fontSize: 8.5,
  },
  bold: {
    fontWeight: 'bold',
  },
  table: {
    marginVertical: 6,
    borderWidth: 0.8,
    borderColor: BLACK,
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 0.8,
    borderColor: BLACK,
    paddingVertical: 5,
    fontWeight: 'bold',
    fontSize: 8.5,
  },
  trRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingVertical: 4,
    fontSize: 8.5,
  },
  colNo: { width: '6%', textAlign: 'center' },
  colBulan: { width: '20%', paddingLeft: 4 },
  colJumlah: { width: '18%', textAlign: 'right', paddingRight: 4 },
  colHarga: { width: '18%', textAlign: 'right', paddingRight: 4 },
  colTotal: { width: '20%', textAlign: 'right', paddingRight: 4 },
  colPajak: { width: '18%', textAlign: 'right', paddingRight: 6 },

  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderColor: BLACK,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: 'bold',
  },

  disclaimer: {
    fontSize: 6.5,
    fontStyle: 'italic',
    color: '#64748b',
    marginTop: 6,
  },

  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    paddingHorizontal: 20,
  },
  signatureBox: {
    alignItems: 'center',
    width: 160,
  },
  signatureTitle: {
    fontSize: 8,
    marginBottom: 28,
  },
  signatureName: {
    fontSize: 8,
    fontWeight: 'bold',
    borderTopWidth: 0.8,
    borderColor: BLACK,
    paddingTop: 2,
    width: '100%',
    textAlign: 'center',
  },
});

export function LaporanPajakReportDocument({
  data,
}: {
  readonly data: LaporanPajakReportData;
}) {
  return (
    <Document title={`Laporan_Pajak_${data.moduleLabel}_${data.year}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.clinicName}>KLINIK PRIMA HUSADA</Text>
              <Text style={styles.clinicAddress}>
                Jl. Siliwangi Ruko Palapa No 2 Parung Kuda. Telp 0857-1932-5557
              </Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.titleSection}>
            <Text style={styles.reportTitle}>Laporan Pajak {data.moduleLabel}</Text>
          </View>

          <View style={styles.infoGrid}>
            <Text style={styles.infoText}>
              Tahun: <Text style={styles.bold}>{data.year}</Text>
            </Text>
            <Text style={styles.infoText}>
              Tarif: <Text style={styles.bold}>0.5% (PPh Final UMKM)</Text>
            </Text>
            <Text style={styles.infoText}>
              Tgl Cetak: <Text style={styles.bold}>{data.tanggalCetak}</Text>
            </Text>
          </View>

          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={styles.colNo}>No</Text>
              <Text style={styles.colBulan}>Bulan</Text>
              <Text style={styles.colJumlah}>Jumlah Pasien</Text>
              <Text style={styles.colHarga}>Harga (Rata-rata)</Text>
              <Text style={styles.colTotal}>Total Penerimaan</Text>
              <Text style={styles.colPajak}>Pajak (0.5%)</Text>
            </View>
            {data.items.length === 0 ? (
              <View style={styles.trRow}>
                <Text style={{ width: '100%', textAlign: 'center', paddingVertical: 4 }}>
                  Belum ada data untuk tahun {data.year}.
                </Text>
              </View>
            ) : (
              data.items.map((row) => (
                <View key={row.no} style={styles.trRow}>
                  <Text style={styles.colNo}>{row.no}</Text>
                  <Text style={styles.colBulan}>{row.bulan}</Text>
                  <Text style={styles.colJumlah}>{row.jumlahPasien}</Text>
                  <Text style={styles.colHarga}>{row.hargaFormatted}</Text>
                  <Text style={styles.colTotal}>{row.totalPenerimaanFormatted}</Text>
                  <Text style={styles.colPajak}>{row.pajakFormatted}</Text>
                </View>
              ))
            )}
            {data.items.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.colNo}></Text>
                <Text style={styles.colBulan}>Total</Text>
                <Text style={styles.colJumlah}>{data.totalJumlahPasien}</Text>
                <Text style={styles.colHarga}></Text>
                <Text style={styles.colTotal}>{data.totalPenerimaanFormatted}</Text>
                <Text style={styles.colPajak}>{data.totalPajakFormatted}</Text>
              </View>
            )}
          </View>

          <Text style={styles.disclaimer}>
            * Pajak dihitung 0.5% dari Total Penerimaan (estimasi PPh Final UMKM sesuai PP
            23/2018), berdasarkan data pasien {data.moduleLabel.toLowerCase()} yang tercatat di
            sistem (arsip Duplikat {data.moduleLabel}). Untuk pelaporan &amp; pembayaran resmi,
            gunakan portal DJP di sse2.pajak.go.id.
          </Text>

          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Petugas Admin Klinik</Text>
              <Text style={styles.signatureName}>( ................................. )</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
