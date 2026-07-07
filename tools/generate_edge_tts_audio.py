#!/usr/bin/env python3
"""Generate Korean Edge TTS audio for Block Math."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

try:
    import edge_tts
except ImportError as exc:
    raise SystemExit(
        "edge-tts is required. Run `python3 -m pip install edge-tts` first."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VOICE = "ko-KR-SunHiNeural"
DEFAULT_RATE = "-8%"
DEFAULT_PRAISE_RATE = "+0%"
DEFAULT_PITCH = "+0Hz"
DEFAULT_VOLUME = "+0%"

DIGITS = {
    0: "영",
    1: "일",
    2: "이",
    3: "삼",
    4: "사",
    5: "오",
    6: "육",
    7: "칠",
    8: "팔",
    9: "구",
}


def number_to_korean(number: int) -> str:
    if number == 100:
        return "백"
    if number < 10:
        return DIGITS[number]

    tens, ones = divmod(number, 10)
    parts = ["십" if tens == 1 else f"{DIGITS[tens]}십"]
    if ones:
        parts.append(DIGITS[ones])
    return " ".join(parts)


def audio_path_for_text(kind: str, text: str) -> str:
    safe = "-".join(f"{ord(ch):04x}" for ch in text if ch.strip())
    return f"audio/{kind}/{safe}.mp3"


def build_items() -> list[dict[str, str]]:
    items: list[dict[str, str]] = [
        {"text": "숫자를 맞혀 볼까요?", "path": audio_path_for_text("system", "숫자를 맞혀 볼까요?"), "rate": DEFAULT_RATE},
        {"text": "다시 해볼까?", "path": audio_path_for_text("system", "다시 해볼까?"), "rate": DEFAULT_RATE},
    ]

    for digit, text in DIGITS.items():
        items.append({"text": text, "path": f"audio/digits/{digit}.mp3", "rate": DEFAULT_RATE})

    for number in range(1, 101):
        spoken = number_to_korean(number)
        items.append({
            "text": spoken,
            "path": f"audio/numbers/{number:03d}.mp3",
            "rate": DEFAULT_RATE,
        })
        items.append({
            "text": f"참 잘했어요! {spoken}!",
            "path": f"audio/praise/{number:03d}.mp3",
            "rate": DEFAULT_PRAISE_RATE,
        })
    return items


async def synthesize_item(
    item: dict[str, str],
    voice: str,
    pitch: str,
    volume: str,
    force: bool,
    semaphore: asyncio.Semaphore,
) -> bool:
    output = ROOT / item["path"]
    if output.exists() and not force:
        return False

    output.parent.mkdir(parents=True, exist_ok=True)
    async with semaphore:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(
                    text=item["text"],
                    voice=voice,
                    rate=item["rate"],
                    volume=volume,
                    pitch=pitch,
                )
                await communicate.save(str(output))
                print(f"{item['text']} -> {item['path']}")
                return True
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(1 + attempt)
    return False


def write_audio_map(items: list[dict[str, str]]) -> int:
    audio_map = {
        item["text"]: item["path"]
        for item in items
        if (ROOT / item["path"]).exists()
    }
    output = ROOT / "audio" / "audio-map.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(audio_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(audio_map)


async def generate(args: argparse.Namespace) -> None:
    items = build_items()
    semaphore = asyncio.Semaphore(args.concurrency)
    results = await asyncio.gather(*[
        synthesize_item(
            item=item,
            voice=args.voice,
            pitch=args.pitch,
            volume=args.volume,
            force=args.force,
            semaphore=semaphore,
        )
        for item in items
    ])
    mapped_count = write_audio_map(items)
    print(f"generated {sum(results)} files, mapped {mapped_count} unique texts from {len(items)} items")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--pitch", default=DEFAULT_PITCH)
    parser.add_argument("--volume", default=DEFAULT_VOLUME)
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    asyncio.run(generate(args))


if __name__ == "__main__":
    main()
