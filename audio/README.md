# Audio

The app prefers local MP3 files generated with Edge TTS and falls back to the browser Web Speech API when audio is missing or playback fails.

- Voice: `ko-KR-SunHiNeural`
- Generated content: digit names, number readings from 1 to 100, praise phrases, and short system prompts.
- Reading style: Sino-Korean numbers such as `삼십 사`, not digit-by-digit `삼 사`.

Regenerate from the repository root:

```bash
python3 -m pip install edge-tts
python3 tools/generate_edge_tts_audio.py --force
```
