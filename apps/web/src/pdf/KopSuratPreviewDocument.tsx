import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface KopSuratPreviewData {
  readonly namaKlinik: string;
  readonly alamat: string;
  readonly telepon: string;
  readonly logoSrc: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: BLACK,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 56,
    height: 56,
    marginRight: 14,
    objectFit: 'contain',
  },
  headerText: {
    flex: 1,
  },
  clinicName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BLUE,
  },
  clinicSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  divider: {
    height: 2.5,
    backgroundColor: BLUE,
    marginTop: 10,
    marginBottom: 20,
  },
  bodyLine: {
    marginTop: 14,
    height: 0.8,
    backgroundColor: '#e2e8f0',
  },
  note: {
    marginTop: 24,
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export function KopSuratPreviewDocument({ data }: { readonly data: KopSuratPreviewData }) {
  return (
    <Document title={`Preview_Kop_Surat_${data.namaKlinik.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.clinicName}>{data.namaKlinik}</Text>
            <Text style={styles.clinicSub}>{data.alamat}</Text>
            {data.telepon ? <Text style={styles.clinicSub}>Telp. {data.telepon}</Text> : null}
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.bodyLine} />
        <View style={styles.bodyLine} />
        <View style={styles.bodyLine} />

        <Text style={styles.note}>
          Pratinjau kop surat — begini tampilan header pada dokumen resmi yang menggunakan Kop Surat ini.
        </Text>
      </Page>
    </Document>
  );
}
