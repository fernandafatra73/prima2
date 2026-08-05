import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface SlipGajiReportData {
  readonly logoSrc: string;
  readonly namaKaryawan: string;
  readonly jabatan: string;
  readonly departemenLabel: string;
  readonly bulanLabel: string;
  readonly tanggalCetak: string;
  readonly gajiPokokFormatted: string;
  readonly tunjanganFormatted: string;
  readonly potonganFormatted: string;
  readonly gajiBersihFormatted: string;
  readonly pph21Formatted: string;
  readonly takeHomeFormatted: string;
  readonly takeHomeTerbilang: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';
const GREEN = '#15803d';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: BLACK,
  },
  frame: {
    height: '100%',
    borderWidth: 1,
    borderColor: BLACK,
    padding: 16,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  clinicName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 2,
  },
  clinicAddress: {
    fontSize: 8.5,
    color: BLACK,
  },
  divider: {
    height: 2.5,
    backgroundColor: BLUE,
    marginVertical: 8,
  },
  titleSection: {
    textAlign: 'center',
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: BLACK,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  reportSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  infoBox: {
    borderWidth: 0.8,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 8,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    width: 90,
    fontSize: 9,
    color: '#475569',
  },
  infoColon: { width: 10, fontSize: 9 },
  infoValue: { flex: 1, fontSize: 9, fontWeight: 'bold' },
  table: {
    borderWidth: 0.8,
    borderColor: BLACK,
    marginBottom: 4,
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 0.8,
    borderColor: BLACK,
    paddingVertical: 5,
    fontWeight: 'bold',
    fontSize: 9,
  },
  trRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingVertical: 5,
    fontSize: 9,
  },
  colUraian: { width: '65%', paddingLeft: 6 },
  colNominal: { width: '35%', textAlign: 'right', paddingRight: 6 },
  sectionLabelRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingLeft: 6,
  },
  sectionLabel: { fontSize: 8, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  takeHomeBox: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 3,
    padding: 10,
  },
  takeHomeLabel: { fontSize: 10, fontWeight: 'bold', color: GREEN },
  takeHomeValue: { fontSize: 15, fontWeight: 'bold', color: GREEN },
  terbilangRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  terbilangLabel: { fontSize: 8.5, fontStyle: 'italic' },
  terbilangValue: { fontSize: 8.5, fontStyle: 'italic', fontWeight: 'bold' },
  disclaimer: {
    fontSize: 6.5,
    fontStyle: 'italic',
    color: '#64748b',
    marginBottom: 10,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingHorizontal: 10,
  },
  signatureBox: {
    alignItems: 'center',
    width: 160,
  },
  signatureTitle: {
    fontSize: 9,
    marginBottom: 32,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    borderTopWidth: 0.8,
    borderColor: BLACK,
    paddingTop: 2,
    width: '100%',
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
  },
});

export function SlipGajiReportDocument({ data }: { readonly data: SlipGajiReportData }) {
  return (
    <Document
      title={`Slip_Gaji_${data.namaKaryawan.replace(/[^a-zA-Z0-9]/g, '_')}_${data.bulanLabel}.pdf`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.clinicName}>KLINIK PRIMA HUSADA</Text>
              <Text style={styles.clinicAddress}>Jl Siliwangi No 28 A Parung Kuda Telp. 0857-1932-5557</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.titleSection}>
            <Text style={styles.reportTitle}>Slip Gaji Karyawan</Text>
            <Text style={styles.reportSubtitle}>Periode {data.bulanLabel}</Text>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Karyawan</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.namaKaryawan}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Jabatan</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.jabatan || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Departemen</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.departemenLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal Cetak</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.tanggalCetak}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={styles.colUraian}>Uraian</Text>
              <Text style={styles.colNominal}>Nominal</Text>
            </View>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Pendapatan</Text>
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colUraian}>Gaji Pokok</Text>
              <Text style={styles.colNominal}>{data.gajiPokokFormatted}</Text>
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colUraian}>Tunjangan</Text>
              <Text style={styles.colNominal}>{data.tunjanganFormatted}</Text>
            </View>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Potongan</Text>
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colUraian}>Potongan Lain-lain</Text>
              <Text style={styles.colNominal}>{data.potonganFormatted}</Text>
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colUraian}>Estimasi PPh 21 *</Text>
              <Text style={styles.colNominal}>{data.pph21Formatted}</Text>
            </View>
          </View>

          <View style={styles.takeHomeBox}>
            <Text style={styles.takeHomeLabel}>TAKE HOME PAY</Text>
            <Text style={styles.takeHomeValue}>{data.takeHomeFormatted}</Text>
          </View>

          <View style={styles.terbilangRow}>
            <Text style={styles.terbilangLabel}>Terbilang: </Text>
            <Text style={styles.terbilangValue}>{data.takeHomeTerbilang}</Text>
          </View>

          <Text style={styles.disclaimer}>
            * PPh 21 adalah estimasi kasar berbasis persentase per rentang gaji, bukan tabel TER resmi DJP. Wajib
            dicek ulang sebelum dipakai sebagai dasar pemotongan pajak resmi.
          </Text>

          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Diterima oleh,</Text>
              <Text style={styles.signatureName}>{data.namaKaryawan}</Text>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Petugas Admin Klinik,</Text>
              <Text style={styles.signatureName}>( ................................. )</Text>
            </View>
          </View>

          <Text style={styles.footerNote}>
            Slip gaji ini sah dan diproses secara komputerisasi oleh sistem Klinik Prima Husada.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
