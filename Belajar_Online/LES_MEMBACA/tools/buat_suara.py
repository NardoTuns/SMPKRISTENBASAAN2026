#!/usr/bin/env python3
"""
Baca Ceria - pembuat rekaman suara.

Membaca daftar rekaman dari js/data.js (lewat js/bahasa.js), membuat rekaman MP3
dengan suara neural Microsoft Edge (paket edge-tts), memotong jeda hening, lalu
mengemasnya menjadi 5 file:
    audio/ui.js       petunjuk & pujian
    audio/huruf.js    nama huruf A-Z (direkam dalam kalimat "Ini huruf A." lalu hurufnya dipotong)
    audio/suku.js     suku kata (ba, bi, bu, ...)
    audio/kata.js     kata
    audio/kalimat.js  kalimat, judul cerita & pertanyaan (+ waktu tiap kata untuk efek karaoke)

Kebutuhan : Python 3.9+, Node.js (untuk membaca js/data.js), internet
            pip install edge-tts imageio-ffmpeg
Pemakaian : python tools/buat_suara.py
            (rekaman yang sudah pernah dibuat disimpan di folder cache,
             jadi menjalankan ulang hanya membuat suara untuk isi yang baru)
"""
import array
import asyncio
import base64
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
CACHE = Path(os.environ.get("BC_AUDIO_CACHE", Path(tempfile.gettempdir()) / "baca-ceria-audio-cache"))

VOICE = "id-ID-GadisNeural"
# huruf memakai kecepatan yang sama dengan suara pemandu (ui), karena direkam dalam kalimat "Ini huruf A."
RATE = {"huruf": "+0%", "suku": "-10%", "kata": "-10%", "kalimat": "-12%", "soal": "-5%", "ui": "+0%"}
BUNDLES = ["ui", "huruf", "suku", "kata", "kalimat"]
KEEP_LEAD = 0.06  # detik hening yang disisakan di awal rekaman
TARGET_DB = -20.0  # kekerasan rata-rata suara pemandu; rekaman pendek disamakan ke sini
PEAK_DB = -1.0     # batas puncak agar suara tidak pecah

# Jeda hening di awal/akhir dipotong lalu dikompres ulang (mono 24 kHz, 40 kbps)
FFMPEG_FILTER = (
    f"silenceremove=start_periods=1:start_threshold=-50dB:start_silence={KEEP_LEAD},"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,"
    "areverse"
)


def load_clips():
    js = ("global.window=global;require(process.argv[1]);require(process.argv[2]);"
          "process.stdout.write(JSON.stringify(window.BC_BAHASA.daftarSuara(window.BC_DATA)))")
    out = subprocess.run(["node", "-e", js, str(ROOT / "js" / "bahasa.js"), str(ROOT / "js" / "data.js")],
                         capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


def clip_hash(text, rate, potong=False, ambil=None):
    tag = ("|potong" if potong else "") + (f"|ambil-{ambil}" if ambil else "")
    return hashlib.sha1(f"{VOICE}|{rate}|{text}{tag}".encode("utf-8")).hexdigest()[:20]


async def synth_all(jobs):
    import edge_tts

    sem = asyncio.Semaphore(6)
    done = 0

    async def one(text, rate, out):
        nonlocal done
        async with sem:
            for attempt in range(5):
                try:
                    com = edge_tts.Communicate(text, VOICE, rate=rate, boundary="WordBoundary")
                    audio, marks = bytearray(), []
                    async for ch in com.stream():
                        if ch["type"] == "audio":
                            audio += ch["data"]
                        elif ch["type"] == "WordBoundary":
                            marks.append([ch["text"], ch["offset"] / 10000.0])
                    if len(audio) < 500:
                        raise RuntimeError("file suara terlalu kecil")
                    tmp = out.with_suffix(".tmp")
                    tmp.write_bytes(bytes(audio))
                    out.with_suffix(".json").write_text(json.dumps(marks, ensure_ascii=False), encoding="utf-8")
                    os.replace(tmp, out)
                    break
                except Exception as e:  # jaringan kadang putus: coba lagi
                    if attempt == 4:
                        raise RuntimeError(f"Gagal membuat suara '{text}': {e}")
                    await asyncio.sleep(2 * (attempt + 1))
            done += 1
            if done % 25 == 0 or done == len(jobs):
                print(f"  suara dibuat: {done}/{len(jobs)}")

    await asyncio.gather(*(one(*j) for j in jobs))


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def lead_silence(ffmpeg, src):
    """Panjang hening di awal rekaman (detik), untuk menggeser waktu tiap kata."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src), "-af", "silencedetect=noise=-50dB:d=0.02", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"silence_start: (-?[\d.]+)\s.*?silence_end: ([\d.]+)", r.stderr, re.S)
    if m and float(m.group(1)) <= 0.01:
        return float(m.group(2))
    return 0.0


def process(ffmpeg, src, dst):
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-af", FFMPEG_FILTER,
                    "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "40k", str(tmp)], check=True)
    os.replace(tmp, dst)
    dst.with_suffix(".lead").write_text(str(lead_silence(ffmpeg, src)), encoding="utf-8")


def decode_pcm(ffmpeg, src, rate=24000):
    raw = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(rate),
                          "-f", "s16le", "pipe:1"], capture_output=True, check=True).stdout
    pcm = array.array("h")
    pcm.frombytes(raw[: len(raw) // 2 * 2])
    return pcm


def frame_db(pcm, hop):
    n = len(pcm) // hop
    return [10 * math.log10(sum(v * v for v in pcm[i * hop:(i + 1) * hop]) / hop + 1e-9) for i in range(n)]


def take_word(ffmpeg, src, marks_file, dst, which="akhir"):
    """Ambil satu kata dari rekaman kalimat: kata terakhir ("A" dari "Ini huruf A.") atau kata pertama
    ("zebra" dari "zebra kuda"). Dipotong di titik paling hening di antara kata, supaya bunyinya jelas
    seperti suara pemandu dan tidak membawa sisa kata di sebelahnya."""
    rate, hop = 24000, 240  # bingkai 10 ms
    marks = json.loads(marks_file.read_text(encoding="utf-8"))
    pcm = decode_pcm(ffmpeg, src, rate)
    db = frame_db(pcm, hop)
    n = len(db)
    pos = -1 if which == "akhir" else 1                # kata yang awalnya menjadi batas potong
    mark = int(marks[pos][1] / 10)                      # awal kata itu menurut mesin suara (perkiraan)
    # cari jeda hening pertama (minimal 40 ms) mulai 150 ms sebelum batas kata
    quiet = max(db) - 35
    lo, hi = max(1, mark - 15), min(n - 1, mark + 40)
    best, run = None, None
    for i in range(lo, hi + 1):
        if db[i] < quiet:
            run = (run[0], i) if run else (i, i)
        elif run:
            if run[1] - run[0] >= 3:
                best = run
                break
            run = None
    if best:
        # potong tepat sebelum kata yang diambil mulai, atau tepat setelah kata yang diambil selesai
        cut = best[1] - 2 if which == "akhir" else best[0] + 2
    else:
        loud = max(db) - 20
        onset = next((i for i in range(mark, n) if db[i] > loud), mark)
        cut = min(range(max(1, mark - 5), max(mark - 4, onset)), key=db.__getitem__)
    out = pcm[cut * hop:] if which == "akhir" else pcm[:cut * hop]
    fade = min(len(out), rate // 100)
    for i in range(fade):
        k = i if which == "akhir" else len(out) - 1 - i
        out[k] = int(out[k] * i / fade)
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
                    "-af", FFMPEG_FILTER, "-c:a", "libmp3lame", "-b:a", "40k", str(tmp)], input=out.tobytes(), check=True)
    os.replace(tmp, dst)


def normalize(ffmpeg, src, dst):
    """Samakan kekerasan rekaman pendek (huruf, suku kata, kata) dengan suara pemandu, tanpa membuat suara pecah."""
    rate, hop = 24000, 240
    pcm = decode_pcm(ffmpeg, src, rate)
    db = [v - 90.309 for v in frame_db(pcm, hop)]  # dBFS
    top = max(db)
    voiced = [v for v in db if v > top - 20]
    loud = sum(voiced) / len(voiced)
    peak = 20 * math.log10(max(1, max(abs(v) for v in pcm)) / 32768)
    gain = max(-6.0, min(TARGET_DB - loud, PEAK_DB - peak, 24.0))
    k = 10 ** (gain / 20)
    out = array.array("h", (max(-32768, min(32767, int(v * k))) for v in pcm))
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
                    "-c:a", "libmp3lame", "-b:a", "40k", str(tmp)], input=out.tobytes(), check=True)
    os.replace(tmp, dst)


def cut_after_vowel(ffmpeg, src, dst, drop_db=12.0):
    """Potong rekaman tepat di akhir vokal (huruf pengganti seperti k/l dibuang) lalu dipudarkan.
    Dipakai untuk suku kata yang direkam dari teks pengganti, mis. "mak" → "ma"."""
    rate, hop = 24000, 240  # bingkai 10 ms
    pcm = decode_pcm(ffmpeg, src, rate)
    db = frame_db(pcm, hop)
    n = len(db)
    sm = [sum(db[max(0, i - 1):i + 2]) / len(db[max(0, i - 1):i + 2]) for i in range(n)]
    peak = max(range(n), key=sm.__getitem__)
    end = peak
    while end + 1 < n and sm[end + 1] >= sm[peak] - drop_db:
        end += 1
    stop = min(len(pcm), (end + 1) * hop + rate * 15 // 1000)
    out = pcm[:stop]
    fade = min(stop, rate * 40 // 1000)
    for i in range(fade):
        k = stop - fade + i
        out[k] = int(out[k] * ((fade - i) / fade) ** 1.5)
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
                    "-c:a", "libmp3lame", "-b:a", "40k", str(tmp)], input=out.tobytes(), check=True)
    os.replace(tmp, dst)


def main():
    clips = load_clips()
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Cache suara: {CACHE}")

    unique = {}
    for c in clips:
        rate = RATE[c["j"]]
        unique[clip_hash(c["t"], rate)] = (c["t"], rate)
    jobs = [(t, r, CACHE / f"{h}.mp3") for h, (t, r) in unique.items() if not (CACHE / f"{h}.mp3").exists()]
    print(f"Total klip: {len(unique)} | perlu dibuat: {len(jobs)}")
    if jobs:
        asyncio.run(synth_all(jobs))

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("GAGAL: ffmpeg tidak ditemukan. Jalankan dulu:  pip install imageio-ffmpeg")
        return 1
    todo = [h for h in unique if not (CACHE / f"{h}.p.mp3").exists()]
    print(f"Memotong jeda hening & kompres: {len(todo)} klip")
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(lambda h: process(ffmpeg, CACHE / f"{h}.mp3", CACHE / f"{h}.p.mp3"), todo))

    def audio_file(h):
        p = CACHE / f"{h}.p.mp3"
        return p if p.exists() else CACHE / f"{h}.mp3"

    def special_file(c):
        if c.get("potong"):
            return CACHE / f"{clip_hash(c['t'], RATE[c['j']], potong=True)}.c.mp3"
        if c.get("ambil"):
            return CACHE / f"{clip_hash(c['t'], RATE[c['j']], ambil=c['ambil'])}.a.mp3"
        return None

    special = [c for c in clips if special_file(c) and not special_file(c).exists()]
    if special:
        print(f"Memotong suku kata pengganti & nama huruf: {len(special)} klip")
    for c in special:
        h = clip_hash(c["t"], RATE[c["j"]])
        if c.get("potong"):
            cut_after_vowel(ffmpeg, audio_file(h), special_file(c))
        else:
            take_word(ffmpeg, CACHE / f"{h}.mp3", CACHE / f"{h}.json", special_file(c), c["ambil"])

    def base_file(c):
        return special_file(c) or audio_file(clip_hash(c["t"], RATE[c["j"]]))

    # rekaman pendek (huruf, suku kata, kata) disamakan kekerasannya dengan suara pemandu
    def short(c):
        return c["k"][:2] in ("h:", "s:", "k:")

    def norm_file(c):
        b = base_file(c)
        return b.with_name(f"{b.stem}.n{abs(int(TARGET_DB))}.mp3")

    todo = list({str(norm_file(c)): c for c in clips if short(c) and not norm_file(c).exists()}.values())
    if todo:
        print(f"Menyamakan kekerasan suara dengan suara pemandu: {len(todo)} klip")
        with ThreadPoolExecutor(max_workers=8) as ex:
            list(ex.map(lambda c: normalize(ffmpeg, base_file(c), norm_file(c)), todo))

    def clip_file(c):
        return norm_file(c) if short(c) else base_file(c)

    def word_marks(h, text):
        """Waktu mulai tiap kata (ms) setelah jeda hening awal dipotong."""
        try:
            marks = json.loads((CACHE / f"{h}.json").read_text(encoding="utf-8"))
        except Exception:
            return None
        lead_file = CACHE / f"{h}.p.lead"
        cut = 0.0
        if (CACHE / f"{h}.p.mp3").exists() and lead_file.exists():
            cut = max(0.0, float(lead_file.read_text()) - KEEP_LEAD) * 1000
        n_words = len(text.split())
        if len(marks) != n_words:
            print(f"  catatan: jumlah kata tidak cocok untuk '{text}' ({len(marks)} vs {n_words}), karaoke memakai perkiraan")
            return None
        return [max(0, round(m[1] - cut)) for m in marks]

    AUDIO_DIR.mkdir(exist_ok=True)
    by_bundle = {b: [] for b in BUNDLES}
    for c in clips:
        by_bundle[c["b"]].append(c)
    total = 0
    for b, items in by_bundle.items():
        rows, marks = [], {}
        for c in items:
            h = clip_hash(c["t"], RATE[c["j"]])
            b64 = base64.b64encode(clip_file(c).read_bytes()).decode("ascii")
            rows.append(f'"{c["k"]}":"{b64}"')
            if c["j"] == "kalimat":
                m = word_marks(h, c["t"])
                if m:
                    marks[c["k"]] = m
        extra = f",{json.dumps({'marks': marks}, separators=(',', ':'))}" if marks else ""
        content = (f"/* Baca Ceria - rekaman suara '{b}' (dibuat otomatis oleh tools/buat_suara.py, jangan diedit) */\n"
                   f'BC_AUDIO("{b}",{{\n' + ",\n".join(rows) + "\n}" + extra + ");\n")
        out = AUDIO_DIR / f"{b}.js"
        out.write_text(content, encoding="utf-8")
        total += out.stat().st_size
        print(f"  {out.name}: {len(items)} klip, {out.stat().st_size / 1024:.0f} KB")

    print(f"Selesai: {len(BUNDLES)} file di {AUDIO_DIR} (total {total / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    sys.exit(main())
