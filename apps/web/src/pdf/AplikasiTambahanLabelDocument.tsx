import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface AplikasiTambahanLabelData {
  readonly kodePasien: string;
  readonly nama: string;
  readonly umur: string;
  readonly alamat: string;
  readonly noTelp: string;
  readonly pemeriksaan: string;
  readonly tanggal: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';

const labelStyles = StyleSheet.create({
  page: { padding: 10, fontFamily: 'Helvetica', fontSize: 9, color: BLACK },
  box: { borderWidth: 1, borderColor: BLACK, borderRadius: 3, padding: 8, height: '100%' },
  title: { fontSize: 10, fontWeight: 'bold', color: BLUE, marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 60 },
  value: { flex: 1, fontWeight: 'bold' },
});

const amplopStyles = StyleSheet.create({
  page: { padding: 24, fontFamily: 'Helvetica', fontSize: 11, color: BLACK },
  sender: { fontSize: 9, color: BLUE, fontWeight: 'bold', marginBottom: 30 },
  recipientLabel: { fontSize: 10, marginBottom: 6 },
  box: {
    marginLeft: 60,
    borderWidth: 0.8,
    borderColor: '#94a3b8',
    padding: 10,
    width: 320,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 70 },
  colon: { width: 10 },
  value: { flex: 1, fontWeight: 'bold' },
});

export function AplikasiTambahanLabelDocument({
  data,
  variant,
}: {
  readonly data: AplikasiTambahanLabelData;
  readonly variant: 'label' | 'amplop';
}) {
  if (variant === 'label') {
    return (
      <Document title={`Label_${data.kodePasien}.pdf`}>
        <Page size={[227, 142]} style={labelStyles.page}>
          <View style={labelStyles.box}>
            <Text style={labelStyles.title}>KLINIK PRIMA HUSADA</Text>
            <View style={labelStyles.row}>
              <Text style={labelStyles.label}>Kode</Text>
              <Text style={labelStyles.value}>{data.kodePasien}</Text>
            </View>
            <View style={labelStyles.row}>
              <Text style={labelStyles.label}>Nama</Text>
              <Text style={labelStyles.value}>{data.nama}</Text>
            </View>
            <View style={labelStyles.row}>
              <Text style={labelStyles.label}>Umur</Text>
              <Text style={labelStyles.value}>{data.umur || '—'}</Text>
            </View>
            <View style={labelStyles.row}>
              <Text style={labelStyles.label}>Pemeriksaan</Text>
              <Text style={labelStyles.value}>{data.pemeriksaan || '—'}</Text>
            </View>
            <View style={labelStyles.row}>
              <Text style={labelStyles.label}>Tanggal</Text>
              <Text style={labelStyles.value}>{data.tanggal}</Text>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document title={`Amplop_${data.kodePasien}.pdf`}>
      <Page size={[624, 312]} style={amplopStyles.page}>
        <Text style={amplopStyles.sender}>KLINIK PRIMA HUSADA — Jl. Siliwangi Ruko Palapa No 2 Parung Kuda</Text>
        <Text style={amplopStyles.recipientLabel}>Kepada Yth,</Text>
        <View style={amplopStyles.box}>
          <View style={amplopStyles.row}>
            <Text style={amplopStyles.label}>Nama</Text>
            <Text style={amplopStyles.colon}>:</Text>
            <Text style={amplopStyles.value}>{data.nama}{data.umur ? `, ${data.umur}` : ''}</Text>
          </View>
          <View style={amplopStyles.row}>
            <Text style={amplopStyles.label}>Alamat</Text>
            <Text style={amplopStyles.colon}>:</Text>
            <Text style={amplopStyles.value}>{data.alamat || '—'}</Text>
          </View>
          <View style={amplopStyles.row}>
            <Text style={amplopStyles.label}>No Telp</Text>
            <Text style={amplopStyles.colon}>:</Text>
            <Text style={amplopStyles.value}>{data.noTelp || '—'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
