# 블록 수 놀이터

만 4세 아이가 알록달록한 하나의 블록 덩어리를 보고 숫자를 드래그해서 맞히는 정적 웹 게임입니다.

## 놀이 방법

1. 첫 화면에서 `시작`을 누릅니다.
2. 위쪽 블록 덩어리가 어떤 숫자인지 보고, 아래 숫자 타일을 빈칸으로 드래그합니다.
3. 맞는 자리의 숫자만 들어가고, 틀린 숫자는 흔들리며 돌아갑니다.
4. 숫자 타일은 사라지지 않아서 같은 숫자를 여러 번 넣을 수 있습니다.
5. 맞추면 1초 동안 완성된 답을 보여 준 뒤 `참 잘했어요!`와 함께 숫자를 한국어로 읽어 줍니다.

## 기술

- 순수 HTML/CSS/JavaScript
- GitHub Pages 같은 static hosting에 바로 배포 가능
- Edge TTS로 미리 생성한 한국어 MP3 우선 재생
- Web Speech API 폴백
- 로컬 생성 배경 이미지와 CSS 블록 렌더링
- HTML Drag and Drop API + 터치 드래그 폴백

## 로컬 실행

정적 파일 fetch와 오디오 재생 확인을 위해 HTTP 서버로 엽니다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## 음성 다시 만들기

```bash
python3 -m pip install edge-tts
python3 tools/generate_edge_tts_audio.py --force
```

## 아트 방향

숫자별 색상 단서는 preschool number-block 학습 관습을 참고하되, 캐릭터와 배경은 이 앱용으로 새로 만든 독립 스타일입니다.
