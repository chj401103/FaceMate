# 시연 흐름 자동 점검 (E2E)

가짜 카메라에 **얼굴 영상**을 넣고, 실제 브라우저(Microsoft Edge)로
`홈 → 표정 연습 → 카메라 시작 → 2초 기본 표정 측정 → 표정 선택 → 미소 연습 → 카메라 정지`를 끝까지 눌러 봅니다.
얼굴이 인식되지 않으면 "기본 표정 측정"이 끝나지 않으므로, 이 흐름이 통과하면 **모델 불러오기와 얼굴 인식이 실제로 동작**한다는 뜻입니다.

```bash
npm install                                  # playwright-core 포함
powershell -File e2e/make-fake-camera.ps1    # e2e/face.y4m 만들기 (한 번만)
npm run dev                                  # 다른 터미널에서
npm run e2e                                  # 기본: https://facemate.vercel.app
node e2e/flow.cjs http://localhost:5173       # 로컬 개발 서버 점검
```

화면은 `e2e/shots/`에 저장됩니다. (영상 파일과 화면 캡처는 저장소에 올리지 않습니다.)

**한계:** 가짜 카메라는 얼굴 사진 한 장을 반복하는 정지 영상이라, 표정을 바꿨을 때의 점수 변화는 이 점검으로 확인하지 못합니다.
Microsoft Edge(Chromium) 한 가지 환경에서만 확인했습니다. 점수 계산 자체는 `npm test`로 따로 확인합니다.
