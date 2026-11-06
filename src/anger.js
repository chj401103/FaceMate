// '화남과 관련된 표정 움직임' 연습용 계산 모듈 (눈썹 모으기·내리기)
// 점수는 감정을 판단하는 것이 아니라 눈썹 움직임의 연습 달성도입니다.
import { faceFrame } from './smile.js'

// 눈썹 특징점 (MediaPipe Face Landmarker). 배열 순서: [본인 오른쪽, 본인 왼쪽]
export const BROW = {
  inner: [107, 336], // 눈썹 앞머리(미간 쪽)
  outer: [70, 300], // 눈썹 바깥쪽 끝 (점수에는 사용하지 않고 표시만)
  upperRow: [[70, 63, 105, 66, 107], [300, 293, 334, 296, 336]], // 눈썹 윗줄 (바깥→앞머리)
  lowerRow: [[46, 53, 52, 65, 55], [276, 283, 282, 295, 285]], // 눈썹 아랫줄 (바깥→앞머리)
  // 눈 앞쪽(눈썹 앞머리와 눈 안쪽 사이) 영역: 눈썹 아랫줄 앞쪽 + 윗눈꺼풀 안쪽 절반
  areaPoly: [[55, 65, 52, 158, 157, 173, 133], [285, 295, 282, 385, 384, 398, 362]],
  // 미간(양쪽 눈썹 사이~콧대 윗부분) 점: 점수에는 쓰지 않고 표시만 (모이는 위치 확인용)
  glabella: [9, 8, 168, 6, 193, 417, 122, 351],
  // 하관(입·턱선) 점: 점수에는 쓰지 않고 표시만 (입꼬리, 윗·아랫입술 중앙, 턱 끝, 턱선)
  lowerFace: [61, 291, 0, 17, 152, 172, 397, 136, 365],
  eyeUpper: [159, 386], // 눈 위 눈꺼풀 (눈썹과의 간격 기준)
  eyeInner: [133, 362], // 눈 안쪽 끝
}

// ── 조정 가능한 목표 상수 (처음에는 보수적으로, 실제 테스트로 조정) ──
export const BROW_BLEND_GAIN = 0.25 // browDown 값이 기본보다 이만큼 오르면 목표
export const BROW_DROP_TARGET = 0.12 // 눈썹 앞머리-눈꺼풀 간격이 12% 줄면 목표
export const BROW_CONVERGE_TARGET = 0.06 // 양쪽 눈썹 앞머리 사이가 6% 좁아지면 목표
export const BROW_AREA_TARGET = 0.1 // 눈 앞쪽 영역 면적이 10% 줄면 목표
export const BROW_BLEND_WEIGHT = 0.7 // 점수 중 blendshape 비중 (나머지는 Landmark 변화)
const LM_WEIGHT = { drop: 0.24, conv: 0.2, area: 0.24, mouth: 0.16, glab: 0.16 }
// 미간 모임: 미간 세로 길이(9↔168)와 콧대 위쪽 가로 폭(193↔417)이 줄어드는 정도. 주름 자체가 아니라 모이는 움직임을 잼
export const GLAB_TARGET = 0.05 // 기준보다 5% 줄면 목표
// 하관: 입꼬리가 '약간' 내려가는 정도 (입 너비 대비 5%, mouthFrown 값 0.2 상승이 목표)
export const MOUTH_DOWN_TARGET = 0.05
export const MOUTH_FROWN_GAIN = 0.2
// 눈썹 움직임 점수 민감도 조절용 임시 가중치 (정확도 향상과는 무관). 최종 점수는 0~100%로 제한.
export const BROW_SCORE_WEIGHT = 3.0
export const ANGER_DONE_THRESHOLD = 0.9

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const pos = (v) => Math.max(0, v)

function polyArea(pts) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

// 얼굴 좌표계(얼굴 너비 단위)에서 눈썹 지표를 계산. 세로 지표·면적은 '눈 높이~코끝' 거리로 나눠
// 고개를 숙이거나 드는 동작(세로 길이 일괄 축소)과 카메라 거리 변화에 영향을 덜 받아요.
export function browGeom(f) {
  const L = (i) => f.toLocal(f.P(i))
  const vref = Math.max(0.05, L(1).y - (L(BROW.eyeInner[0]).y + L(BROW.eyeInner[1]).y) / 2)
  const inner = BROW.inner.map(L)
  const sides = [0, 1].map((k) => {
    const gapL = L(BROW.eyeUpper[k]).y - inner[k].y // 눈썹이 눈꺼풀 위에 있으면 양수
    return { gap: gapL / vref, gapL, area: polyArea(BROW.areaPoly[k].map(L)) / vref }
  })
  const mouth = [L(61), L(291)]
  const glab = { v: (L(168).y - L(9).y) / vref, h: Math.abs(L(417).x - L(193).x) }
  return { inner, span: Math.abs(inner[1].x - inner[0].x), vref, sides, mouth, glab }
}

export const browSample = (face, w, h) => browGeom(faceFrame(face, w, h))

export function makeBrowBaseline(samples) {
  const n = samples.length
  const avg = (fn) => samples.reduce((s, x) => s + fn(x), 0) / n
  const inner = [0, 1].map((k) => ({ x: avg((s) => s.inner[k].x), y: avg((s) => s.inner[k].y) }))
  const sides = [0, 1].map((k) => ({
    gap: avg((s) => s.sides[k].gap),
    gapL: avg((s) => s.sides[k].gapL),
    area: avg((s) => s.sides[k].area),
  }))
  const span = avg((s) => s.span)
  const mx = (inner[0].x + inner[1].x) / 2
  return {
    inner, sides, span, vref: avg((s) => s.vref),
    mouth: [0, 1].map((k) => ({ x: avg((s) => s.mouth[k].x), y: avg((s) => s.mouth[k].y) })),
    glab: { v: avg((s) => s.glab.v), h: avg((s) => s.glab.h) },
    mouthW: avg((s) => Math.abs(s.mouth[1].x - s.mouth[0].x)) || 0.35,
    // 입꼬리 목표: 기준 입 너비의 5%만큼 약간 아래로
    mouthTargets: [0, 1].map((k) => {
      const m = { x: avg((s) => s.mouth[k].x), y: avg((s) => s.mouth[k].y) }
      const w = avg((s) => Math.abs(s.mouth[1].x - s.mouth[0].x)) || 0.35
      return { x: m.x, y: m.y + MOUTH_DOWN_TARGET * w }
    }),
    // 목표 위치는 사용자의 기준 얼굴·눈썹 크기에서 계산 (고정 픽셀 아님). 눈썹 끝은 목표 없음.
    targets: [0, 1].map((k) => ({
      inner: {
        x: inner[k].x + Math.sign(mx - inner[k].x) * (BROW_CONVERGE_TARGET * span) / 2,
        y: inner[k].y + BROW_DROP_TARGET * sides[k].gapL,
      },
    })),
  }
}

// base: { raw, width, brow }
export function evaluateAnger(base, face, w, h, blend, smooth) {
  const f = faceFrame(face, w, h)
  const g = browGeom(f)
  const bb = base.brow
  const ratio = f.width / base.width
  const pitchRatio = g.vref / bb.vref
  let gateReason = ''
  if (ratio < 0.8 || ratio > 1.25) gateReason = '카메라와의 거리 변화'
  else if (f.yawRatio < 0.6 || f.yawRatio > 1.67) gateReason = '고개 좌우 회전'
  else if (pitchRatio < 0.75 || pitchRatio > 1.33) gateReason = '고개 숙임/듦'
  const gated = !!gateReason

  const parts = []
  const conv = clamp01(pos((bb.span - g.span) / bb.span) / BROW_CONVERGE_TARGET)
  // 하관: 입꼬리가 기준보다 약간 내려갔는지 (Landmark) + mouthFrown (blendshape) 평균
  const cornerDrop = clamp01(
    (pos(g.mouth[0].y - bb.mouth[0].y) + pos(g.mouth[1].y - bb.mouth[1].y)) /
      2 / (bb.mouthW * MOUTH_DOWN_TARGET),
  )
  const frown = clamp01(
    ((blend.raw.mouthFrownL + blend.raw.mouthFrownR) / 2 -
      (base.raw.mouthFrownL + base.raw.mouthFrownR) / 2) / MOUTH_FROWN_GAIN,
  )
  const mouth = 0.5 * cornerDrop + 0.5 * frown
  const glabV = clamp01(pos((bb.glab.v - g.glab.v) / bb.glab.v) / GLAB_TARGET)
  const glabH = clamp01(pos((bb.glab.h - g.glab.h) / bb.glab.h) / GLAB_TARGET)
  const glab = 0.5 * glabV + 0.5 * glabH
  const bs = [blend.raw.browR, blend.raw.browL]
  const b0 = [base.raw.browR, base.raw.browL]
  for (let k = 0; k < 2; k++) {
    const drop = clamp01(pos((bb.sides[k].gap - g.sides[k].gap) / bb.sides[k].gap) / BROW_DROP_TARGET)
    const area = clamp01(pos((bb.sides[k].area - g.sides[k].area) / bb.sides[k].area) / BROW_AREA_TARGET)
    const lm = LM_WEIGHT.drop * drop + LM_WEIGHT.conv * conv + LM_WEIGHT.area * area + LM_WEIGHT.mouth * mouth + LM_WEIGHT.glab * glab
    const bl = clamp01((bs[k] - b0[k]) / BROW_BLEND_GAIN)
    parts.push({ drop, conv, area, mouth, glab, lm, bl })
    if (!gated) {
      const raw = clamp01(BROW_SCORE_WEIGHT * (BROW_BLEND_WEIGHT * bl + (1 - BROW_BLEND_WEIGHT) * lm))
      const key = 's' + k
      smooth[key] = smooth[key] == null ? raw : smooth[key] + 0.4 * (raw - smooth[key])
    }
  }
  if (!gated) smooth.m = smooth.m == null ? mouth : smooth.m + 0.4 * (mouth - smooth.m)
  if (!gated) smooth.g = smooth.g == null ? glab : smooth.g + 0.4 * (glab - smooth.g)
  const glabScore = smooth.g ?? 0
  const mouthScore = smooth.m ?? 0
  const right = smooth.s0 ?? 0
  const left = smooth.s1 ?? 0
  const overall = (right + left) / 2

  let hint
  if (gated) hint = '얼굴을 정면으로 하고, 처음 측정할 때의 거리와 높이를 유지해 주세요.'
  else if (overall < 0.6) hint = '눈썹 안쪽을 편안하게 조금 모아보세요.'
  else hint = '좋아요! 눈썹 움직임이 목표에 가까워졌어요.'

  return { f, gated, gateReason, right, left, overall, hint, parts, mouthScore, glabScore, mouthParts: { cornerDrop, frown, glabV, glabH } }
}
