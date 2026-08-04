import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { truncatePdfCell } from './pdfText.ts';

export interface FarmasiKwitansiItemData {
  readonly nama: string;
  readonly qty: number;
  readonly hargaSatuanFormatted: string;
  readonly subtotalFormatted: string;
}

export interface FarmasiKwitansiReportData {
  readonly logoSrc: string;
  readonly noKwitansi: string;
  readonly tanggal: string;
  readonly namaPasien: string;
  readonly items: readonly FarmasiKwitansiItemData[];
  readonly totalFormatted: string;
  readonly terbilang: string;
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly kasirNama: string;
}

const BLUE = '#2b4c9b';
const BLACK = '#1a1a1a';
const GREEN = '#15803d';
const RED = '#b91c1c';

const styles = StyleSheet.create({
  page: {
    padding: 14,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: BLACK,
  },
  frame: {
    height: '100%',
    borderWidth: 1,
    borderColor: BLACK,
    padding: 14,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logo: {
    width: 46,
    height: 46,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    paddingTop: 2,
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
  noBox: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  noBoxLabel: {
    fontSize: 7,
    color: BLUE,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  noBoxValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BLUE,
  },
  divider: {
    height: 2.5,
    backgroundColor: BLUE,
    marginTop: 8,
    marginBottom: 10,
  },
  titleSection: {
    textAlign: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: BLACK,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 110,
    fontSize: 9.5,
    color: BLACK,
  },
  infoColon: {
    width: 10,
    fontSize: 9.5,
  },
  infoValue: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: 'bold',
    borderBottomWidth: 0.8,
    borderColor: '#cbd5e1',
    paddingBottom: 2,
  },
  infoSection: {
    marginBottom: 10,
  },
  table: {
    marginTop: 6,
    marginBottom: 6,
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
    fontSize: 9,
  },
  trRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingVertical: 4,
    fontSize: 9,
  },
  colNo: { width: '8%', textAlign: 'center' },
  colUraian: { width: '42%', paddingLeft: 4 },
  colQty: { width: '12%', textAlign: 'center' },
  colHargaSatuan: { width: '18%', textAlign: 'right', paddingRight: 4 },
  colSubtotal: { width: '20%', textAlign: 'right', paddingRight: 4 },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    borderTopWidth: 0.8,
    borderColor: BLACK,
  },
  totalLabel: { width: '80%', textAlign: 'right', paddingRight: 8, fontSize: 10, fontWeight: 'bold' },
  totalValue: { width: '20%', textAlign: 'right', paddingRight: 4, fontSize: 11, fontWeight: 'bold', color: BLUE },
  terbilangRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 12,
  },
  terbilangLabel: {
    fontSize: 8.5,
    fontStyle: 'italic',
  },
  terbilangValue: {
    fontSize: 8.5,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.2,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingHorizontal: 10,
  },
  signatureBox: {
    alignItems: 'center',
    width: 150,
  },
  signatureTitle: {
    fontSize: 9,
    marginBottom: 30,
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
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
  },
});

export function FarmasiKwitansiReportDocument({ data }: { readonly data: FarmasiKwitansiReportData }) {
  const isLunas = data.paymentStatus === 'LUNAS';

  return (
    <Document title={`Kwitansi_Farmasi_${data.noKwitansi}.pdf`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.clinicSmall}>APOTEK / FARMASI</Text>
              <Text style={styles.clinicName}>PRIMA HUSADA</Text>
              <Text style={styles.clinicAddress}>Jl Siliwangi No 28 A Parung Kuda Telp. 0857-1932-5557</Text>
            </View>
            <View style={styles.noBox}>
              <Text style={styles.noBoxLabel}>No. Kwitansi</Text>
              <Text style={styles.noBoxValue}>{data.noKwitansi}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.titleSection}>
            <Text style={styles.reportTitle}>KWITANSI FARMASI</Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Telah terima dari</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{truncatePdfCell(data.namaPasien, 60)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{data.tanggal}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={styles.colNo}>No</Text>
              <Text style={styles.colUraian}>Nama Obat / BHP</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colHargaSatuan}>Harga</Text>
              <Text style={styles.colSubtotal}>Subtotal</Text>
            </View>
            {data.items.length === 0 ? (
              <View style={styles.trRow}>
                <Text style={{ width: '100%', textAlign: 'center', paddingVertical: 4 }}>
                  Tidak ada rincian item.
                </Text>
              </View>
            ) : (
              data.items.map((item, i) => (
                <View key={i} style={styles.trRow}>
                  <Text style={styles.colNo}>{i + 1}</Text>
                  <Text style={styles.colUraian}>{truncatePdfCell(item.nama, 38)}</Text>
                  <Text style={styles.colQty}>{item.qty}</Text>
                  <Text style={styles.colHargaSatuan}>{item.hargaSatuanFormatted}</Text>
                  <Text style={styles.colSubtotal}>{item.subtotalFormatted}</Text>
                </View>
              ))
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL PEMBAYARAN</Text>
              <Text style={styles.totalValue}>{data.totalFormatted}</Text>
            </View>
          </View>

          <View style={styles.terbilangRow}>
            <Text style={styles.terbilangLabel}>Terbilang: </Text>
            <Text style={styles.terbilangValue}>{data.terbilang}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { borderColor: isLunas ? GREEN : RED, backgroundColor: isLunas ? '#f0fdf4' : '#fef2f2' },
            ]}
          >
            <Text style={[styles.statusText, { color: isLunas ? GREEN : RED }]}>
              {isLunas ? '✓ LUNAS' : 'BELUM LUNAS'}
            </Text>
          </View>

          <View style={styles.bottomSection}>
            <View style={{ flex: 1 }} />
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTitle}>Petugas Kasir,</Text>
              <Text style={styles.signatureName}>
                {data.kasirNama ? data.kasirNama : '( ................................. )'}
              </Text>
            </View>
          </View>

          <Text style={styles.footerNote}>
            Kwitansi ini sah dan diproses secara komputerisasi oleh sistem Klinik Prima Husada.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
