import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface PendaftaranKopSuratData {
  readonly logoSrc: string;
  readonly noRegistrasi: string;
  readonly namaPasien: string;
  readonly umur: string;
  readonly alamat: string;
  readonly telpon: string;
  readonly tanggalMasuk: string;
  readonly dokterPengirim: string;
  readonly klinis: string;
  readonly admin: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BLACK,
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
    objectFit: 'contain',
  },
  headerText: {
    flex: 1,
  },
  clinicSmall: {
    fontSize: 8,
    color: BLACK,
  },
  clinicName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: BLUE,
    marginTop: 1,
  },
  clinicAddress: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  divider: {
    height: 2.5,
    backgroundColor: BLUE,
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  labelCell: {
    width: '16.66%',
    backgroundColor: '#f0f9ff',
    padding: 6,
    fontWeight: 'bold',
    color: '#0369a1',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  valueCell: {
    width: '16.66%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  lastCell: {
    borderRightWidth: 0,
  },
  footerNote: {
    marginTop: 20,
    fontSize: 7.5,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export function PendaftaranKopSuratDocument({ data }: { readonly data: PendaftaranKopSuratData }) {
  const rows: readonly (readonly [string, string, string, string, string, string])[] = [
    ['No. Registrasi', data.noRegistrasi, 'Nama Pasien', data.namaPasien, 'Tanggal Masuk', data.tanggalMasuk],
    ['Umur', data.umur || '-', 'No. Telepon', data.telpon || '-', 'Dokter Pengirim', data.dokterPengirim || '-'],
    ['Alamat', data.alamat || '-', 'Admin Pendaftaran', data.admin || '-', 'Klinis', data.klinis || '-'],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.clinicSmall}>KLINIK ROENTGEN DAN USG</Text>
            <Text style={styles.clinicName}>PRIMA HUSADA</Text>
            <Text style={styles.clinicAddress}>
              Jl Siliwangi No 28 A Parung Kuda Telp. 0857-1932-5557
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>Formulir Pendaftaran Pasien</Text>

        <View style={styles.table}>
          {rows.map((cells, rowIdx) => (
            <View key={rowIdx} style={rowIdx === rows.length - 1 ? { ...styles.row, ...styles.lastRow } : styles.row}>
              {cells.map((cell, cellIdx) => {
                const isLabel = cellIdx % 2 === 0;
                const isLast = cellIdx === cells.length - 1;
                const baseStyle = isLabel ? styles.labelCell : styles.valueCell;
                return (
                  <Text key={cellIdx} style={isLast ? { ...baseStyle, ...styles.lastCell } : baseStyle}>
                    {cell}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>Dicetak dari sistem LabPrima — Klinik Prima Husada</Text>
      </Page>
    </Document>
  );
}
