"""Original deterministic dark-ambient score and synthesized game SFX; stdlib only."""
from array import array
from pathlib import Path
import json
import math
import random
import wave

RATE = 22050
TAU = math.tau
OUT = Path(__file__).resolve().parents[1] / "Audio"
OUT.mkdir(exist_ok=True)
report = {}


def save(name, channels, music=False):
    peak = max(abs(x) for ch in channels for x in ch) or 1
    scale = (0.5 if music else 0.63) / peak
    pcm = array("h")
    energy = 0
    for frame in zip(*channels):
        for sample in frame:
            value = sample * scale
            energy += value * value
            pcm.append(round(value * 32767))
    with wave.open(str(OUT / (name + ".wav")), "wb") as f:
        f.setparams((len(channels), 2, RATE, len(channels[0]), "NONE", "not compressed"))
        f.writeframes(pcm.tobytes())
    report[name] = {"seconds": len(channels[0]) / RATE, "channels": len(channels),
                    "peak": peak * scale, "rms": math.sqrt(energy / len(pcm)),
                    "seamDelta": max(abs(ch[0] - ch[-1]) * scale for ch in channels)}
    print("Generated", name, flush=True)


def effect(name, length, start, end, noise=0, bell=False, notes=None):
    rng = random.Random(174 + sum(map(ord, name)))
    data = array("f")
    phase = smooth = 0
    for i in range(round(length * RATE)):
        t = i / RATE
        u = t / length
        phase += TAU * (start + (end - start) * u) / RATE
        smooth = smooth * .55 + rng.uniform(-1, 1) * .45
        env = min(1, t / .006) * (1 - u) ** 2
        tone = math.sin(phase) * .7 + math.sin(phase * (2.76 if bell else 2)) * .2
        if notes:
            index = min(len(notes) - 1, int(u * len(notes)))
            local = t - index * length / len(notes)
            tone = sum(math.sin(TAU * notes[index] * harmonic * local) / harmonic ** 2 for harmonic in (1, 2, 3))
            tone *= min(1, local / .008) * math.exp(-local * 5)
        data.append(env * ((1 - noise) * tone + noise * smooth))
    data[0] = data[-1] = 0
    save(name, [data])


def score(name, length, tension):
    count = length * RATE
    left = array("f", [0]) * count
    right = array("f", [0]) * count
    # Frequencies complete whole cycles, making the underlying drones loop exactly.
    bass = round(36.708 * length) / length
    for i in range(count):
        t = i / RATE
        lfo = math.sin(TAU * t / length)
        root = .12 * math.sin(TAU * bass * t) + .06 * math.sin(TAU * bass * 2 * t)
        left[i] = root + .035 * (1 + .4 * lfo) * math.sin(TAU * (round(73.1 * length) / length) * t)
        right[i] = root + .035 * (1 - .4 * lfo) * math.sin(TAU * (round(73.7 * length) / length) * t)
    chords = [(146.83, 174.61, 220, 311.13), (116.54, 146.83, 174.61, 207.65),
              (155.56, 185, 220, 293.66), (138.59, 164.81, 220, 293.66)]
    segment = length / 4
    for bar, chord in enumerate(chords):
        start = bar * segment
        duration = segment + 3
        for voice, freq in enumerate(chord):
            for j in range(round(duration * RATE)):
                t = j / RATE
                env = math.sin(math.pi * t / duration) ** 2
                sample = .027 * env * (math.sin(TAU * freq * t) + .12 * math.sin(TAU * freq * 3.001 * t))
                slot = (round(start * RATE) + j) % count
                pan = .2 + .2 * voice
                left[slot] += sample * (1 - pan)
                right[slot] += sample * pan
    # Sparse inharmonic bells, with a quiet, distant reflection.
    motif = [293.66, 311.13, 220, 349.23, 277.18, 293.66, 415.30, 220]
    for note, freq in enumerate(motif):
        start = 2 + note * length / len(motif)
        for j in range(4 * RATE):
            t = j / RATE
            env = min(1, t / .035) * math.exp(-t * 1.4)
            sample = (.026 + tension * .018) * env * sum(math.sin(TAU * freq * h * t) * a for h, a in [(1, 1), (2.76, .27), (4.07, .09)])
            slot = (round(start * RATE) + j) % count
            left[slot] += sample * (.8 if note % 2 else .3)
            right[slot] += sample * (.3 if note % 2 else .8)
    rng = random.Random(971)
    wind = 0
    for i in range(count):
        t = i / RATE
        wind = wind * .985 + rng.uniform(-1, 1) * .015
        texture = wind * .08 * math.sin(math.pi * t / length) ** 2
        beat = 0
        if tension:
            period = 2 if tension == 1 else 1.5
            age = t % period
            beat = .045 * tension * math.sin(TAU * 47 * age) * min(1, age / .015) * math.exp(-age * 10)
        left[i] += texture + beat
        right[i] += texture + beat
    # Circular delays preserve the complete tail across the loop boundary.
    dry_l, dry_r = array("f", left), array("f", right)
    for i in range(count):
        left[i] += .22 * dry_r[(i - round(.371 * RATE)) % count] + .11 * dry_l[(i - round(.719 * RATE)) % count]
        right[i] += .22 * dry_l[(i - round(.419 * RATE)) % count] + .11 * dry_r[(i - round(.773 * RATE)) % count]
    # A short circular seam crossfade also smooths pad/texture phase changes.
    seam = round(.025 * RATE)
    for ch in (left, right):
        midpoint = (ch[0] + ch[-1]) / 2
        for i in range(seam):
            w = i / seam
            ch[i] = midpoint * (1 - w) + ch[i] * w
            ch[-1-i] = midpoint * (1 - w) + ch[-1-i] * w
    save(name, [left, right], True)


for args in [
    ("shot", .12, 180, 55, .65), ("fire", .32, 120, 55, .85),
    ("electric", .24, 950, 170, .45), ("energy", .32, 180, 650, .12),
    ("melee", .18, 220, 70, .7), ("whip", .22, 500, 90, .8),
    ("magic", .55, 260, 390, .08, True), ("explosion", .5, 80, 25, .75),
    ("ice", .42, 1100, 520, .2, True), ("acid", .3, 140, 75, .55),
    ("water", .3, 300, 100, .8), ("orbit", .3, 560, 330, .05, True),
    ("hit", .065, 170, 65, .55), ("kill", .12, 95, 35, .6),
    ("hurt", .28, 110, 45, .25), ("gem", .11, 740, 980, 0, True),
    ("dash", .22, 270, 70, .85), ("shield", .35, 520, 330, .03, True),
    ("boss", 1.4, 78, 37, .12), ("death", 1.5, 180, 35, .08),
    ("ui", .075, 440, 330, .01), ("pause", .18, 220, 165, 0),
]:
    effect(*args)
for name, notes, length in [
    ("heal", [293.66, 369.99], .45), ("chest", [220, 293.66, 349.23], .8),
    ("upgrade", [293.66, 349.23, 440], .85), ("evolution", [220, 293.66, 349.23, 440], 1.3),
    ("boss_death", [146.83, 110, 73.42], 1.4), ("revive", [146.83, 220, 293.66], 1.2),
    ("start", [146.83, 174.61, 220], .8),
]:
    effect(name, length, 0, 0, notes=notes)
score("menu", 64, 0)
score("night", 64, 1)
score("boss_music", 48, 2)
(OUT / "analysis.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
assert all(row["peak"] <= .64 for row in report.values())
assert all(report[k]["seamDelta"] < .0001 for k in ("menu", "night", "boss_music"))
