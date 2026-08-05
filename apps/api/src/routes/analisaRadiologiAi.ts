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

const BACAAN_KESAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    namaPemeriksaan: {
      type: Type.STRING,
      description:
        'Perkiraan jenis pemeriksaan radiologi yang paling sesuai dengan foto (mis. "Thorax PA", "BNO", "Cranium AP/Lateral"). Isi "Tidak dapat ditentukan" jika tidak jelas.',
    },
    bacaan: {
      type: Type.STRING,
      description:
        'Bacaan (temuan naratif detail) ala laporan radiologi konvensional, dalam Bahasa Indonesia — uraikan tiap struktur yang tampak. Jika foto kurang jelas, sebutkan itu secara eksplisit alih-alih menebak.',
    },
    kesan: {
      type: Type.STRING,
      description: 'Kesan (impression) ringkas — kesimpulan singkat dari bacaan di atas, dalam Bahasa Indonesia.',
    },
  },
  required: ['namaPemeriksaan', 'bacaan', 'kesan'],
};

const AI_RADIOLOGI_SYSTEM_PROMPT = `Anda adalah asisten AI yang membantu radiolog di sebuah klinik membaca foto rontgen/radiologi untuk membuat DRAFT AWAL laporan (bacaan + kesan), bukan diagnosis final.

Aturan:
- Hasil Anda akan selalu ditampilkan ke pengguna dengan label eksplisit sebagai "draft AI yang wajib ditinjau ulang oleh radiolog" — Anda tidak perlu menambahkan disclaimer itu sendiri di dalam teks, cukup fokus pada isi bacaan & kesan.
- "Bacaan" adalah uraian naratif detail (seperti bagian "Findings" pada laporan radiologi konvensional): jelaskan tiap struktur relevan yang tampak pada foto.
- "Kesan" adalah kesimpulan/impression singkat dari bacaan tersebut.
- Jika gambar buram, tidak jelas, bukan foto rontgen, atau tidak cukup informasi, katakan itu secara eksplisit (mis. "Foto tidak cukup jelas untuk dibaca") alih-alih menebak-nebak.
- Jangan berikan rekomendasi pengobatan, dosis obat, atau resep.
- Tulis dalam Bahasa Indonesia, ringkas, dan gunakan istilah medis yang wajar dipakai radiolog Indonesia.
- Jawab HANYA sesuai skema JSON yang diberikan.`;

export async function registerAnalisaRadiologiAiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { page?: string; limit?: string; q?: string } }>(
    '/api/analisa-radiologi-ai',
    async (req) => {
      const { page, limit, skip } = parsePagination(req.query);
      const q = req.query.q?.trim();
      const where = q ? { namaPasien: { contains: q } } : {};
      const [total, items] = await Promise.all([
        prisma.analisaRadiologiAi.count({ where }),
        prisma.analisaRadiologiAi.findMany({
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
      namaPemeriksaan?: string;
      fotoDataUrl?: string;
      bacaan?: string;
      kesan?: string;
      isDraftAi?: boolean;
      radiologNama?: string;
      tanggal?: string;
    };
  }>('/api/analisa-radiologi-ai', async (req, reply) => {
    const b = req.body;
    if (!b.namaPasien?.trim() || !b.fotoDataUrl?.trim()) {
      return badRequest(reply, 'namaPasien dan fotoDataUrl wajib diisi');
    }
    const item = await prisma.analisaRadiologiAi.create({
      data: {
        namaPasien: b.namaPasien.trim(),
        namaPemeriksaan: b.namaPemeriksaan?.trim() || null,
        fotoDataUrl: b.fotoDataUrl,
        bacaan: b.bacaan?.trim() || null,
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
      namaPemeriksaan?: string;
      fotoDataUrl?: string;
      bacaan?: string;
      kesan?: string;
      isDraftAi?: boolean;
      radiologNama?: string;
      tanggal?: string;
    };
  }>('/api/analisa-radiologi-ai/:id', async (req, reply) => {
    const existing = await prisma.analisaRadiologiAi.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Data analisa radiologi AI tidak ditemukan' });
    const b = req.body;
    const item = await prisma.analisaRadiologiAi.update({
      where: { id: req.params.id },
      data: {
        namaPasien: b.namaPasien?.trim() ?? existing.namaPasien,
        namaPemeriksaan:
          b.namaPemeriksaan !== undefined ? b.namaPemeriksaan?.trim() || null : existing.namaPemeriksaan,
        fotoDataUrl: b.fotoDataUrl ?? existing.fotoDataUrl,
        bacaan: b.bacaan !== undefined ? b.bacaan?.trim() || null : existing.bacaan,
        kesan: b.kesan !== undefined ? b.kesan?.trim() || null : existing.kesan,
        isDraftAi: b.isDraftAi ?? existing.isDraftAi,
        radiologNama: b.radiologNama !== undefined ? b.radiologNama?.trim() || null : existing.radiologNama,
        tanggal: b.tanggal ? new Date(b.tanggal) : existing.tanggal,
      },
    });
    return { item: { ...item, tanggal: item.tanggal.toISOString() } };
  });

  app.delete<{ Params: { id: string } }>('/api/analisa-radiologi-ai/:id', async (req) => {
    await prisma.analisaRadiologiAi.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.post<{
    Body: { fotoDataUrl?: string; namaPemeriksaan?: string; namaPasien?: string };
  }>('/api/analisa-radiologi-ai/analyze', async (req, reply) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(503).send({
        error: 'Fitur analisa AI belum dikonfigurasi. Admin perlu mengatur GEMINI_API_KEY di server.',
      });
    }

    const { fotoDataUrl, namaPemeriksaan, namaPasien } = req.body;
    if (!fotoDataUrl?.trim()) {
      return badRequest(reply, 'fotoDataUrl wajib diisi');
    }
    const parsedImage = parseImageDataUrl(fotoDataUrl);
    if (!parsedImage) {
      return badRequest(reply, 'Format foto tidak didukung. Gunakan JPEG, PNG, GIF, atau WEBP.');
    }

    const contextLines = [
      namaPasien?.trim() ? `Nama pasien: ${namaPasien.trim()}` : null,
      namaPemeriksaan?.trim() ? `Jenis pemeriksaan: ${namaPemeriksaan.trim()}` : null,
    ].filter((line): line is string => Boolean(line));

    try {
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: parsedImage.mediaType, data: parsedImage.data } },
              {
                text: [
                  ...contextLines,
                  'Baca foto rontgen/radiologi di atas dan berikan draft nama pemeriksaan, bacaan (temuan detail), dan kesan (impression) sesuai skema JSON.',
                ].join('\n'),
              },
            ],
          },
        ],
        config: {
          systemInstruction: AI_RADIOLOGI_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: BACAAN_KESAN_RESPONSE_SCHEMA,
        },
      });

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        return reply.status(502).send({
          error: 'AI menolak membaca foto ini. Silakan isi bacaan & kesan secara manual.',
        });
      }

      const text = response.text;
      if (!text) {
        return reply.status(502).send({ error: 'AI tidak mengembalikan hasil bacaan yang valid.' });
      }

      let parsed: { namaPemeriksaan?: unknown; bacaan?: unknown; kesan?: unknown };
      try {
        parsed = JSON.parse(text) as { namaPemeriksaan?: unknown; bacaan?: unknown; kesan?: unknown };
      } catch {
        return reply.status(502).send({ error: 'AI mengembalikan format hasil yang tidak valid.' });
      }

      return {
        namaPemeriksaan: typeof parsed.namaPemeriksaan === 'string' ? parsed.namaPemeriksaan : '',
        bacaan: typeof parsed.bacaan === 'string' ? parsed.bacaan : '',
        kesan: typeof parsed.kesan === 'string' ? parsed.kesan : '',
      };
    } catch (err) {
      req.log.error(err, 'Gagal memanggil AI vision untuk analisa radiologi');
      return reply.status(502).send({
        error: err instanceof Error ? `Gagal menghubungi layanan AI: ${err.message}` : 'Gagal menghubungi layanan AI',
      });
    }
  });
}
