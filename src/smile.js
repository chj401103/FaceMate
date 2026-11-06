// 미소·눈웃음 연습용 계산 모듈 (화면 그리기와 분리된 순수 계산 함수들)
// 점수는 감정이나 사회적 능력의 평가가 아니라 '표정 움직임 연습 달성도'입니다.

export const MOUTH_CORNERS = [61, 291]
export const EYE_POINTS = {
  outer: [33, 263], // 눈꼬리
  upperLid: [159, 386],
  lowerLid: [145, 374],
  cheek: [50, 280], // 눈 아래 볼
}
const FACE_EDGE = [234, 454] // 얼굴 좌·우 끝 (얼굴 너비 기준)
const NOSE = 1

// 눈웃음 변화량 민감도 조절용 임시 설정값입니다. (감정 인식 정확도와는 무관)
export const EYE_SMILE_WEIGHT = 2.0

export const MEASURE_MS = 2000
export const HOLD_MS = 1000
export const DONE_THRESHOLD = 0.9

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 머리 움직임·거리에 영향을 덜 받도록, 얼굴 좌우 끝 점으로 만든 '얼굴 좌표계'.
// 좌표는 얼굴 너비 단위이므로 카메라에 다가가도 값이 거의 같아요.
export function faceFrame(face, w, h) {
  const P = (i) => ({ x: face[i].x * w, y: face[i].y * h })
  const a = P(FACE_EDGE[0])
  const b = P(FACE_EDGE[1])
  const width = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / width
  const uy = (b.y - a.y) / width
  const vx = -uy // 얼굴 기준 '아래' 방향
  const vy = ux
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const nose = P(NOSE)
  const dl = Math.hypot(nose.x - a.x, nose.y - a.y)
  const dr = Math.hypot(nose.x - b.x, nose.y - b.y)
  return {
    P,
    width,
    yawRatio: dl / (dr || 1), // 1에 가까울수록 정면
    toLocal: (p) => ({
      x: ((p.x - c.x) * ux + (p.y - c.y) * uy) / width,
      y: ((p.x - c.x) * vx + (p.y - c.y) * vy) / width,
    }),
    fromLocal: (l) => ({
      x: c.x + (ux * l.x + vx * l.y) * width,
      y: c.y + (uy * l.x + vy * l.y) * width,
    }),
    up: { x: -vx, y: -vy }, // 얼굴 기준 '위' 단위 벡터
  }
}

export function readBlend(result) {
  const cats = result.faceBlendshapes?.[0]?.categories
  if (!cats) return null
  const m = {}
  for (const c of cats) m[c.categoryName] = c.score
  const g = (n) => m[n] ?? 0
  return {
    raw: {
      cheekL: g('cheekSquintLeft'), cheekR: g('cheekSquintRight'),
      squintL: g('eyeSquintLeft'), squintR: g('eyeSquintRight'),
      blinkL: g('eyeBlinkLeft'), blinkR: g('eyeBlinkRight'),
      browL: g('browDownLeft'), browR: g('browDownRight'),
      mouthFrownL: g('mouthFrownLeft'), mouthFrownR: g('mouthFrownRight'),
      browInnerUp: g('browInnerUp'),
      browOuterUpL: g('browOuterUpLeft'), browOuterUpR: g('browOuterUpRight'),
      eyeWideL: g('eyeWideLeft'), eyeWideR: g('eyeWideRight'),
      jawOpen: g('jawOpen'),
    },
    smile: (g('mouthSmileLeft') + g('mouthSmileRight')) / 2,
    cheek: (g('cheekSquintLeft') + g('cheekSquintRight')) / 2,
    squint: (g('eyeSquintLeft') + g('eyeSquintRight')) / 2,
    blink: (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2,
  }
}

// 눈웃음 지표: 볼 올림을 중심으로, 눈 찡그림은 일부만 반영(상한 적용)
export const eyeMetric = (b) => 0.6 * b.cheek + 0.4 * Math.min(b.squint, 0.6)

// 눈웃음 점수: 변화량에 가중치를 곱한 뒤 0~1(0~100%)로 제한. weight=1이면 가중치 적용 전 점수.
export const eyeScore = (metric, base, weight = EYE_SMILE_WEIGHT) =>
  clamp01((weight * (metric - base.eye)) / (base.eyeTarget - base.eye))

// 점 위치로 직접 재는 눈웃음 지표 (blendshape 신호가 약한 사람을 위한 보조 방식)
// aper: 눈 열림 정도(눈꺼풀 간격 ÷ 얼굴 너비), gap: 볼 점과 아래 눈꺼풀 사이의 세로 간격
// 둘 다 얼굴 너비 기준이라 카메라에 다가가도 값이 거의 같고, 기준 대비 '줄어든 비율'로 점수를 냅니다.
// 임시 목표값이며 실제 데이터를 보고 조정해야 해요. (감정 인식 정확도와는 무관)
export const EYE_USE_GEOMETRY = true
const GEOM_APER_TARGET = 0.15 // 눈 열림이 15% 줄어들면 목표
const GEOM_GAP_TARGET = 0.12 // 볼-눈꺼풀 간격이 12% 줄어들면 목표

export function geomOf(f) {
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  let aper = 0
  let gap = 0
  for (let k = 0; k < 2; k++) {
    const up = f.P(EYE_POINTS.upperLid[k])
    const lo = f.P(EYE_POINTS.lowerLid[k])
    const ch = f.P(EYE_POINTS.cheek[k])
    aper += D(up, lo) / f.width / 2
    gap += (f.toLocal(ch).y - f.toLocal(lo).y) / 2
  }
  return { aper, gap }
}

const clampPos = (v) => Math.max(0, v)
export function eyeGeomScore(g, base) {
  if (!base.geom || !(base.geom.aper > 0) || !(base.geom.gap > 0)) return 0
  const rAper = clampPos((base.geom.aper - g.aper) / base.geom.aper) / GEOM_APER_TARGET
  const rGap = clampPos((base.geom.gap - g.gap) / base.geom.gap) / GEOM_GAP_TARGET
  return clamp01(0.5 * rAper + 0.5 * rGap)
}

export function frameSample(face, w, h, blend) {
  const f = faceFrame(face, w, h)
  return {
    geom: geomOf(f),
    corners: MOUTH_CORNERS.map((i) => f.toLocal(f.P(i))),
    smile: blend.smile,
    eye: eyeMetric(blend),
    blink: blend.blink,
    raw: blend.raw,
    width: f.width,
  }
}

// 2초 동안 모은 샘플의 평균 = 개인의 편안한 기본 표정
export function makeBaseline(samples) {
  const n = samples.length
  const avg = (fn) => samples.reduce((s, x) => s + fn(x), 0) / n
  const corners = [0, 1].map((k) => ({
    x: avg((s) => s.corners[k].x),
    y: avg((s) => s.corners[k].y),
  }))
  const smile = avg((s) => s.smile)
  const eye = avg((s) => s.eye)
  const mouthW = Math.abs(corners[1].x - corners[0].x) || 0.35
  return {
    corners,
    smile,
    eye,
    blink: avg((s) => s.blink),
    geom: { aper: avg((s) => s.geom.aper), gap: avg((s) => s.geom.gap) },
    raw: Object.fromEntries(Object.keys(samples[0].raw).map((k) => [k, avg((s) => s.raw[k])])),
    width: avg((s) => s.width),
    // 무리하지 않는 개인별 목표 (기본값에서 조금만 더)
    smileTarget: smile + clamp(0.4 * (1 - smile), 0.15, 0.35),
    eyeTarget: eye + 0.2,
    // 얼굴 좌표계에서의 목표 입꼬리 위치: 살짝 위·바깥쪽
    targets: corners.map((c) => ({
      x: c.x + Math.sign(c.x || 1) * 0.05 * mouthW,
      y: c.y - 0.12 * mouthW,
    })),
  }
}

// 현재 프레임 평가. smooth 객체에 부드럽게 보정한 값을 저장합니다.
export function evaluate(base, face, w, h, blend, smooth) {
  const f = faceFrame(face, w, h)
  const ratio = f.width / base.width
  const gated = ratio < 0.8 || ratio > 1.25 || f.yawRatio < 0.6 || f.yawRatio > 1.67
  if (!gated) {
    const mouthRaw = clamp01((blend.smile - base.smile) / (base.smileTarget - base.smile))
    // 눈을 감는 쪽(깜빡임 증가)으로 점수가 오르지 않게 함
    const eyeOk = blend.blink - base.blink < 0.4
    const eyeRaw = eyeOk
      ? Math.max(
          eyeScore(eyeMetric(blend), base),
          EYE_USE_GEOMETRY ? eyeGeomScore(geomOf(f), base) : 0,
        )
      : 0
    const k = 0.4
    smooth.mouth = smooth.mouth == null ? mouthRaw : smooth.mouth + k * (mouthRaw - smooth.mouth)
    smooth.eye = smooth.eye == null ? eyeRaw : smooth.eye + k * (eyeRaw - smooth.eye)
  }
  const mouth = smooth.mouth ?? 0
  const eye = smooth.eye ?? 0
  const overall = 0.8 * mouth + 0.2 * eye

  let hint
  if (gated) hint = '얼굴을 정면으로 하고, 처음 측정할 때의 거리를 유지해 주세요.'
  else if (mouth < 0.6) hint = '입꼬리를 편안하게 조금 올려보세요.'
  else if (eye < 0.5) hint = '볼을 살짝 올리며 눈 주변의 변화를 느껴보세요.'
  else hint = '좋아요! 입과 눈 주변 움직임이 목표에 가까워졌어요.'

  return { f, gated, mouth, eye, overall, hint }
}
