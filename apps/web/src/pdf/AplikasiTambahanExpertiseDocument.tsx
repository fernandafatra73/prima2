import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface AplikasiTambahanExpertiseData {
  readonly logoSrc: string;
  readonly kodePasien: string;
  readonly tanggal: string;
  readonly nama: string;
  readonly umur: string;
  readonly pemeriksaan: string;
  readonly klinis: string;
  readonly pengirim: string;
  readonly kesan1: string;
  readonly kesan2: string;
  readonly kesan3: string;
  readonly kesan4: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BLACK,
  },
  frame: {
    height: '100%',
    borderWidth: 1,
    borderColor: BLACK,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: { width: 46, height: 46, marginRight: 10 },
  headerText: { flex: 1 },
  clinicName: { fontSize: 15, fontWeight: 'bold', color: BLUE, marginBottom: 2 },
  clinicAddress: { fontSize: 8, lineHeight: 1.35 },
  divider: { height: 2, backgroundColor: BLUE, marginVertical: 6 },
  titleSection: { textAlign: 'center', marginVertical: 4 },
  reportTitle: { fontSize: 13, fontWeight: 'bold', color: BLUE, textTransform: 'uppercase' },
  infoGrid: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { width: 110, fontSize: 9 },
  infoColon: { width: 10, fontSize: 9 },
  infoValue: { flex: 1, fontSize: 9, fontWeight: 'bold' },
  kesanBlock: { marginTop: 10 },
  kesanTitle: { fontSize: 10, fontWeight: 'bold', color: BLUE, marginBottom: 4, textTransform: 'uppercase' },
  kesanItem: { fontSize: 9.5, marginBottom: 4, lineHeight: 1.4 },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  signatureBox: { alignItems: 'center', width: 170 },
  signatureTitle: { fontSize: 8, marginBottom: 34 },
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

export function AplikasiTambahanExpertiseDocument({
  data,
}: {
  readonly data: AplikasiTambahanExpertiseData;
}) {
  const kesanList = [data.kesan1, data.kesan2, data.kesan3, data.kesan4].filter((k) => k?.trim());

  return (
    <Document title={`Expertise_${data.kodePasien}.pdf`}>
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
            <Text style={styles.reportTitle}>Hasil Expertise</Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Kode Pasien</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.kodePasien}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.nama}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Umur</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.umur || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pemeriksaan</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.pemeriksaan || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Klinis</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.klinis || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dokter Pengirim</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.pengirim || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.tanggal}</Text>
            </View>
          </View>

          <View style={styles.kesanBlock}>
            <Text style={styles.kesanTitle}>Kesan</Text>
            {kesanList.length === 0 ? (
              <Text style={styles.kesanItem}>—</Text>
            ) : (
              kesanList.map((k, i) => (
                <Text key={i} style={styles.kesanItem}>
                  {i + 1}. {k}
                </Text>
              ))
            )}
          </View>

          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Dokter / Radiolog</Text>
              <Text style={styles.signatureName}>( ................................. )</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
