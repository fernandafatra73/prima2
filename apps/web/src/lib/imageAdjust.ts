export interface PhotoAdjustments {
  /** -50..50, 0 = tidak diubah. */
  readonly contrast: number;
  /** 0..100 (jumlah sharpen/ketajaman detail), 0 = tidak diubah. */
  readonly detail: number;
}

/** Foto besar (mis. hasil kamera HP) dibatasi dimensinya di sini supaya konvolusi sharpen tetap cepat. */
const MAX_ADJUST_DIM = 2000;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat foto untuk diproses'));
    img.src = dataUrl;
  });
}

/** Unsharp-mask sederhana (kernel 3x3) untuk menambah "detail"/ketajaman foto. */
function sharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const k = Math.min(amount, 100) / 100;
  const weights = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sd = src.data;
  const dd = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstOff = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let wi = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const sy = Math.min(height - 1, Math.max(0, y + ky));
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(width - 1, Math.max(0, x + kx));
            sum += sd[(sy * width + sx) * 4 + c] * weights[wi];
            wi++;
          }
        }
        dd[dstOff + c] = Math.min(255, Math.max(0, sum));
      }
      dd[dstOff + 3] = sd[dstOff + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/**
 * Menerapkan kontras & detail (sharpen) ke foto lalu mengembalikan data URL baru (JPEG).
 * Dipanggil ulang dari data URL foto ASLI setiap slider berubah, bukan ditumpuk dari hasil sebelumnya.
 */
export async function applyPhotoAdjustments(rawDataUrl: string, adjustments: PhotoAdjustments): Promise<string> {
  const { contrast, detail } = adjustments;
  if (contrast === 0 && detail === 0) return rawDataUrl;

  const img = await loadImage(rawDataUrl);
  const scale = Math.min(1, MAX_ADJUST_DIM / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;

  ctx.filter = contrast !== 0 ? `contrast(${100 + contrast}%)` : 'none';
  ctx.drawImage(img, 0, 0, width, height);
  ctx.filter = 'none';
  sharpen(ctx, width, height, detail);

  return canvas.toDataURL('image/jpeg', 0.92);
}
