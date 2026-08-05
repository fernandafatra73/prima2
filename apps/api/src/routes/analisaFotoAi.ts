import type { FastifyInstance, FastifyReply } from 'fastify';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '../lib/prisma.js';
import { buildPaginationMeta, parsePagination } from '../lib/pagination.js';

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply.status(400).send({ error: message });
}

const ALLOWED_IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedImageMediaType = (typeof ALLOWED_IMAGE_MEDIA_TYPES)[number];

function parseImageDataUrl(
  dataUrl: string,
): { readonly mediaType: AllowedImageMediaType; readonly data: string } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mediaType, data] = match;
  if (!ALLOWED_IMAGE_MEDIA_TYPES.includes(mediaType as AllowedImageMediaType)) return null;
  return { mediaType: mediaType as AllowedImageMediaType, data: data! };
}

const KESAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    namaPenyakit: {
      type: Type.STRING,
      description:
        'Kemungkinan nama penyakit/kondisi yang paling sesuai dengan temuan pada foto, dalam Bahasa Indonesia. Isi "Tidak dapat ditentukan" jika foto tidak cukup jelas/informatif.',
    },
    kesan: {
      type: Type.STRING,
      description:
        'Kesan (impression) naratif singkat berisi temuan yang tampak pada foto, dalam Bahasa Indonesia. Jika foto kurang jelas, sebutkan itu secara eksplisit alih-alih menebak.',
    },
  },
  required: ['namaPenyakit', 'kesan'],
};

const AI_FOTO_SYSTEM_PROMPT = `Anda adalah asisten AI yang membantu radiolog/dokter di sebuah klinik membaca foto medis (foto anatomi, luka, kondisi kulit, atau foto rontgen) untuk membuat DRAFT AWAL, bukan diagnosis final.

Aturan:
- Hasil Anda akan selalu ditampilkan ke pengguna dengan label eksplisit sebagai "draft AI yang wajib ditinjau ulang oleh radiolog/dokter" — Anda tidak perlu menambahkan disclaimer itu sendiri di dalam teks, cukup fokus pada isi analisa.
- Jika gambar buram, tidak jelas, bukan foto medis, atau tidak cukup informasi untuk membuat kesimpulan yang masuk akal, katakan itu secara eksplisit (mis. "Foto tidak cukup jelas untuk dianalisa") alih-alih menebak-nebak.
- Jangan berikan rekomendasi pengobatan, dosis obat, atau resep.
- Tulis dalam Bahasa Indonesia, ringkas, dan gunakan istilah medis yang wajar dipakai radiolog Indonesia.
- Jawab HANYA sesuai skema JSON yang diberikan.`;

export async function registerAnalisaFotoAiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { page?: string; limit?: string; q?: string } }>(
    '/api/analisa-foto-ai',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const q = req.query.q?.trim();
      const where = q ? { namaPasien: { contains: q } } : {};
      const [total, items] = await Promise.all([
        prisma.analisaFotoAi.count({ where }),
        prisma.analisaFotoAi.findMany({
          where,
          orderBy: { tanggal: 'desc' },
          skip,
          take: limit,
        }),
      ]);
      return {
        items: items.map((item) => ({ ...item, tanggal: item.tanggal.toISOString() })),
        pagination: buildPaginationMeta(total, page, limit),
      };
    },
  );

  app.post<{
    Body: {
      namaPasien?: string;
      pemeriksaan?: string;
      namaPenyakit?: string;
      fotoDataUrl?: string;
      kesan?: string;
      isDraftAi?: boolean;
      radiologNama?: string;
      tanggal?: string;
    };
  }>('/api/analisa-foto-ai', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim() || !b.fotoDataUrl?.trim()) {
      return badRequest(reply, 'namaPasien dan fotoDataUrl wajib diisi');
    }
    const item = await prisma.analisaFotoAi.create({
      data: {
        namaPasien: b.namaPasien.trim(),
        pemeriksaan: b.pemeriksaan?.trim() || null,
        namaPenyakit: b.namaPenyakit?.trim() || null,
        fotoDataUrl: b.fotoDataUrl,
        kesan: b.kesan?.trim() || null,
        isDraftAi: b.isDraftAi ?? false,
        radiologNama: b.radiologNama?.trim() || null,
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
      },
    });
    return reply.status(201).send({ item: { ...item, tanggal: item.tanggal.toISOString() } });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      namaPasien?: string;
      pemeriksaan?: string;
      namaPenyakit?: string;
      fotoDataUrl?: string;
      kesan?: string;
      isDraftAi?: boolean;
      radiologNama?: string;
      tanggal?: string;
    };
  }>('/api/analisa-foto-ai/:id', async (req, reply) => {
    const existing = await prisma.analisaFotoAi.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data analisa foto AI tidak ditemukan' });
    const b = req.body;
    const item = await prisma.analisaFotoAi.update({
      where: { id: req.params.id },
      data: {
        namaPasien: b.namaPasien?.trim() ?? existing.namaPasien,
        pemeriksaan: b.pemeriksaan !== undefined ? b.pemeriksaan?.trim() || null : existing.pemeriksaan,
        namaPenyakit: b.namaPenyakit !== undefined ? b.namaPenyakit?.trim() || null : existing.namaPenyakit,
        fotoDataUrl: b.fotoDataUrl ?? existing.fotoDataUrl,
        kesan: b.kesan !== undefined ? b.kesan?.trim() || null : existing.kesan,
        isDraftAi: b.isDraftAi ?? existing.isDraftAi,
        radiologNama: b.radiologNama !== undefined ? b.radiologNama?.trim() || null : existing.radiologNama,
        tanggal: b.tanggal ? new Date(b.tanggal) : existing.tanggal,
      },
    });
    return { item: { ...item, tanggal: item.tanggal.toISOString() } };
  });

  app.delete<{ Params: { id: string } }>('/api/analisa-foto-ai/:id', async (req) => {
    await prisma.analisaFotoAi.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{
    Body: { fotoDataUrl?: string; pemeriksaan?: string; namaPasien?: string };
  }>('/api/analisa-foto-ai/analyze', async (req, reply) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(503).send({
        error: 'Fitur analisa AI belum dikonfigurasi. Admin perlu mengatur GEMINI_API_KEY di server.',
      });
    }

    const { fotoDataUrl, pemeriksaan, namaPasien } = req.body;
    if (!fotoDataUrl?.trim()) {
      return badRequest(reply, 'fotoDataUrl wajib diisi');
    }
    const parsedImage = parseImageDataUrl(fotoDataUrl);
    if (!parsedImage) {
      return badRequest(reply, 'Format foto tidak didukung. Gunakan JPEG, PNG, GIF, atau WEBP.');
    }

    const contextLines = [
      namaPasien?.trim() ? `Nama pasien: ${namaPasien.trim()}` : null,
      pemeriksaan?.trim() ? `Jenis pemeriksaan: ${pemeriksaan.trim()}` : null,
    ].filter((line): line is string => Boolean(line));

    try {
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: parsedImage.mediaType, data: parsedImage.data } },
              {
                text: [
                  ...contextLines,
                  'Analisa foto di atas dan berikan draft kemungkinan nama penyakit/kondisi serta kesan (impression) singkat sesuai skema JSON.',
                ].join('\n'),
              },
            ],
          },
        ],
        config: {
          systemInstruction: AI_FOTO_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: KESAN_RESPONSE_SCHEMA,
        },
      });

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        return reply.status(502).send({
          error: 'AI menolak menganalisa foto ini. Silakan isi nama penyakit & kesan secara manual.',
        });
      }

      const text = response.text;
      if (!text) {
        return reply.status(502).send({ error: 'AI tidak mengembalikan hasil analisa yang valid.' });
      }

      let parsed: { namaPenyakit?: unknown; kesan?: unknown };
      try {
        parsed = JSON.parse(text) as { namaPenyakit?: unknown; kesan?: unknown };
      } catch {
        return reply.status(502).send({ error: 'AI mengembalikan format hasil yang tidak valid.' });
      }

      return {
        namaPenyakit: typeof parsed.namaPenyakit === 'string' ? parsed.namaPenyakit : '',
        kesan: typeof parsed.kesan === 'string' ? parsed.kesan : '',
      };
    } catch (err) {
      req.log.error(err, 'Gagal memanggil AI vision untuk analisa foto');
      return reply.status(502).send({
        error: err instanceof Error ? `Gagal menghubungi layanan AI: ${err.message}` : 'Gagal menghubungi layanan AI',
      });
    }
  });
}
