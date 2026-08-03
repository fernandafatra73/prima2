import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface LogoPerusahaanReportData {
  readonly namaKlinik: string;
  readonly logoPerusahaan: string | null;
  readonly logoTandaTangan: string | null;
  readonly tanggalCetak: string;
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
  frame: {
    height: '100%',
    flexDirection: 'column',
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
  titleSection: {
    textAlign: 'center',
    marginBottom: 24,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textDecoration: 'underline',
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 8,
    lineHeight: 1.8,
    textAlign: 'justify',
    color: '#334155',
  },
  bodyLine: {
    marginTop: 10,
    height: 0.8,
    backgroundColor: '#e2e8f0',
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    paddingHorizontal: 20,
  },
  signatureBox: {
    alignItems: 'center',
    width: 220,
  },
  signatureDate: {
    fontSize: 10,
    marginBottom: 6,
  },
  signatureImage: {
    width: 130,
    height: 60,
    objectFit: 'contain',
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 'bold',
    textDecoration: 'underline',
    marginTop: 6,
  },
  footerNote: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
  },
});

export function LogoPerusahaanReportDocument({ data }: { readonly data: LogoPerusahaanReportData }) {
  return (
    <Document title={`Contoh_Kop_Surat_${data.namaKlinik.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            {data.logoPerusahaan ? <Image style={styles.logo} src={data.logoPerusahaan} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.clinicName}>{data.namaKlinik}</Text>
              <Text style={styles.clinicSub}>Contoh tampilan kop surat &amp; tanda tangan resmi</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.titleSection}>
            <Text style={styles.reportTitle}>Contoh Kop Surat</Text>
          </View>

          <Text style={styles.body}>
            Lembar ini adalah pratinjau bagaimana Logo Perusahaan dan Logo Tanda Tangan akan tampil
            pada dokumen resmi {data.namaKlinik}. Gunakan tombol Edit untuk mengganti logo atau nama
            klinik, lalu cetak ulang halaman ini untuk melihat hasil terbaru.
          </Text>
          <View style={styles.bodyLine} />
          <View style={styles.bodyLine} />
          <View style={styles.bodyLine} />

          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureDate}>{data.tanggalCetak}</Text>
              {data.logoTandaTangan ? (
                <Image style={styles.signatureImage} src={data.logoTandaTangan} />
              ) : (
                <Text style={{ fontSize: 9, color: '#94a3b8' }}>( Logo Tanda Tangan belum diisi )</Text>
              )}
              <Text style={styles.signatureName}>{data.namaKlinik}</Text>
            </View>
          </View>

          <Text style={styles.footerNote}>
            Dokumen ini hanya contoh tampilan, dihasilkan otomatis oleh sistem Klinik Prima Husada.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
