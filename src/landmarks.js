// MediaPipe Face Landmarker(468+ 점) 중 눈·코·입의 주요 점 번호입니다.
// 이후 단계에서 표정 분석에도 이 번호들을 재사용할 수 있어요.
export const FEATURE_POINTS = {
  // '본인' 기준 오른쪽 눈 / 왼쪽 눈
  rightEye: [33, 133, 159, 145, 158, 153, 160, 144],
  leftEye: [362, 263, 386, 374, 385, 380, 387, 373],
  nose: [1, 2, 4, 168, 98, 327],
  mouth: [61, 291, 0, 17, 13, 14, 78, 308, 37, 267, 84, 314],
}

export const ALL_FEATURE_INDICES = Object.values(FEATURE_POINTS).flat()
