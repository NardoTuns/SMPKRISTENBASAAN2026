#!/usr/bin/env python3
"""
English Ceria - pembuat rekaman suara.

Membaca kosakata dari js/data.js, membuat rekaman MP3 (suara neural Microsoft
Edge lewat paket edge-tts), memotong jeda hening, lalu mengemas hasilnya menjadi
audio/L01.js ... audio/Lxx.js (satu file per level) dan audio/ui.js (instruksi
& pujian). Dikemas per level supaya jumlah file di repositori tetap sedikit.

Kebutuhan : Python 3.9+, Node.js (untuk membaca js/data.js), internet
            pip install edge-tts imageio-ffmpeg
Pemakaian : python tools/buat_suara.py
            (rekaman yang sudah pernah dibuat disimpan di folder cache,
             jadi menjalankan ulang hanya membuat suara untuk kata baru)
"""
import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
CACHE = Path(os.environ.get("EC_AUDIO_CACHE", Path(tempfile.gettempdir()) / "english-ceria-audio-cache"))

VOICE_EN = "en-US-AnaNeural"     # suara anak, jelas & ceria
VOICE_ID = "id-ID-GadisNeural"
RATE_EN = "-10%"
RATE_EN_SLOW = "-45%"
RATE_ID = "-5%"
RATE_PHRASE = "+0%"

# Jeda hening di awal/akhir dipotong lalu dikompres ulang (mono 24 kHz, 40 kbps)
FFMPEG_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,"
    "areverse"
)


def slug(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def speak_text(text, lang):
    return text.replace("&", " and " if lang == "en" else " dan ")


def load_data():
    js = "global.window=global;require(process.argv[1]);process.stdout.write(JSON.stringify(window.EC_DATA))"
    out = subprocess.run(["node", "-e", js, str(ROOT / "js" / "data.js")],
                         capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


def build_clip_list(data):
    bundles = {}

    def add(bundle, key, text, voice, rate):
        bundles.setdefault(bundle, {})[key] = (text, voice, rate)

    for lv in data["levels"]:
        b = "L%02d" % lv["n"]
        add(b, "lvid", speak_text(lv["name"], "id"), VOICE_ID, RATE_ID)
        add(b, "lven", speak_text(lv["en"], "en"), VOICE_EN, RATE_EN)
        for w in lv["words"]:
            t = w.get("tts") or w["en"]
            add(b, "en:" + slug(w["en"]), t, VOICE_EN, RATE_EN)
            add(b, "es:" + slug(w["en"]), t, VOICE_EN, RATE_EN_SLOW)
            add(b, "id:" + slug(w["ind"]), w["ind"], VOICE_ID, RATE_ID)
    for key, p in data["phrases"].items():
        add("ui", key, p["text"], VOICE_EN if p["lang"] == "en" else VOICE_ID, RATE_PHRASE)
    return bundles


def clip_hash(text, voice, rate):
    return hashlib.sha1(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:20]


async def synth_all(jobs):
    import edge_tts

    sem = asyncio.Semaphore(6)
    done = 0

    async def one(text, voice, rate, out):
        nonlocal done
        async with sem:
            for attempt in range(5):
                try:
                    tmp = out.with_suffix(".tmp")
                    await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
                    if tmp.stat().st_size < 500:
                        raise RuntimeError("file suara terlalu kecil")
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


def process(ffmpeg, src, dst):
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-af", FFMPEG_FILTER,
                    "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "40k", str(tmp)], check=True)
    os.replace(tmp, dst)


def main():
    data = load_data()
    bundles = build_clip_list(data)
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Cache suara: {CACHE}")

    unique = {}
    for items in bundles.values():
        for text, voice, rate in items.values():
            unique[clip_hash(text, voice, rate)] = (text, voice, rate)

    jobs = [(t, v, r, CACHE / f"{h}.mp3") for h, (t, v, r) in unique.items() if not (CACHE / f"{h}.mp3").exists()]
    print(f"Total klip: {len(unique)} | perlu dibuat: {len(jobs)}")
    if jobs:
        asyncio.run(synth_all(jobs))

    ffmpeg = find_ffmpeg()
    if ffmpeg:
        todo = [h for h in unique if not (CACHE / f"{h}.p.mp3").exists()]
        print(f"Memotong jeda hening & kompres: {len(todo)} klip")
        with ThreadPoolExecutor(max_workers=8) as ex:
            list(ex.map(lambda h: process(ffmpeg, CACHE / f"{h}.mp3", CACHE / f"{h}.p.mp3"), todo))
    else:
        print("PERINGATAN: ffmpeg tidak ditemukan (pip install imageio-ffmpeg). Memakai MP3 asli tanpa dipotong.")

    def audio_file(h):
        p = CACHE / f"{h}.p.mp3"
        return p if p.exists() else CACHE / f"{h}.mp3"

    AUDIO_DIR.mkdir(exist_ok=True)
    written = set()
    total = 0
    for b, items in bundles.items():
        rows = []
        for key, (text, voice, rate) in items.items():
            b64 = base64.b64encode(audio_file(clip_hash(text, voice, rate)).read_bytes()).decode("ascii")
            rows.append(f'"{key}":"{b64}"')
        content = (f"/* English Ceria - rekaman suara {b} (dibuat otomatis oleh tools/buat_suara.py, jangan diedit) */\n"
                   f'EC_AUDIO("{b}",{{\n' + ",\n".join(rows) + "\n});\n")
        out = AUDIO_DIR / f"{b}.js"
        out.write_text(content, encoding="utf-8")
        written.add(out.name)
        total += out.stat().st_size

    for f in AUDIO_DIR.glob("*.js"):
        if f.name not in written and (re.fullmatch(r"L\d+\.js", f.name) or f.name == "ui.js"):
            f.unlink()
            print(f"  hapus file lama: {f.name}")

    print(f"Selesai: {len(written)} file di {AUDIO_DIR} (total {total / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    sys.exit(main())
