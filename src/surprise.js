// '놀람과 관련된 표정 움직임' 연습용 계산 모듈 (눈썹 올리기·눈 크게 뜨기·입 살짝 벌리기)
// 점수는 감정을 판단하는 것이 아니라 표정 움직임의 연습 달성도입니다.
import { faceFrame, geomOf } from './smile.js'
import { browGeom } from './anger.js'

export const SUR = {
  mid: [105, 334], // 눈썹 위쪽 중간 (눈썹 올림 가이드)
  lid: [159, 386], // 윗눈꺼풀 (눈 크게 뜨기 가이드)
  lip: 17, // 아랫입술 중앙 (입 벌림 가이드)
  upperLip: 13,
  lowerLip: 14,
}

// ── 조정 가능한 목표 상수 (처음에는 보수적으로, 실제 테스트로 조정) ──
export const SURPRISE_SCORE_WEIGHT = 1.5 // 민감도 조절용 임시 가중치 (정확도 향상과 무관), 최종 0~100% 제한
export const SUR_BROW_GAIN = 0.25 // browInnerUp / browOuterUp blendshape 상승 목표
export const SUR_BROW_UP_TARGET = 0.1 // 눈썹-눈꺼풀 간격이 10% 늘어나면 목표
export const SUR_EYE_GAIN = 0.25 // eyeWide blendshape 상승 목표
export const SUR_EYE_TARGET = 0.1 // 눈 열림이 10% 커지면 목표
export const SUR_JAW_GAIN = 0.2 // jawOpen 상승 목표 (입을 '살짝' 벌림)
export const SUR_MOUTH_TARGET = 0.15 // 입술 사이 간격이 입 너비의 15%만큼 벌어지면 목표
export const SUR_BLEND_WEIGHT = 0.7 // 파트 점수 중 blendshape 비중 (나머지는 Landmark 변화)
// 눈 크게 뜨기 파트에만 추가로 곱하는 민감도 가중치 (임시 설정, 정확도 향상과 무관)
export const SUR_EYE_SCORE_WEIGHT = 1.5
// 눈썹 올림 파트에만 추가로 곱하는 민감도 가중치 (임시 설정)
export const SUR_BROW_SCORE_WEIGHT = 1.0
export const SUR_PART_WEIGHT = { brow: 0.4, eye: 0.35, mouth: 0.25 }
export const SURPRISE_DONE_THRESHOLD = 0.9

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const pos = (v) => Math.max(0, v)

export function surpriseSample(face, w, h) {
  const f = faceFrame(face, w, h)
  const L = (i) => f.toLocal(f.P(i))
  const mouthW = Math.abs(L(291).x - L(61).x) || 0.35
  return {
    mid: SUR.mid.map(L),
    lid: SUR.lid.map(L),
    lip: L(SUR.lip),
    open: Math.abs(L(SUR.lowerLip).y - L(SUR.upperLip).y) / mouthW,
    mouthW,
  }
}

// base: 기본 표정 기준값 (base.brow, base.geom 재사용)
export function makeSurpriseBaseline(samples, base) {
  const n = samples.length
  const avg = (fn) => samples.reduce((s, x) => s + fn(x), 0) / n
  const pt = (get) => ({ x: avg((s) => get(s).x), y: avg((s) => get(s).y) })
  const mid = [0, 1].map((k) => pt((s) => s.mid[k]))
  const lid = [0, 1].map((k) => pt((s) => s.lid[k]))
  const lip = pt((s) => s.lip)
  const mouthW = avg((s) => s.mouthW)
  return {
    open: avg((s) => s.open),
    // 목표 위치는 기준 얼굴·눈썹·입 크기에서 계산 (고정 픽셀 아님)
    targets: {
      mid: mid.map((m, k) => ({ x: m.x, y: m.y - SUR_BROW_UP_TARGET * base.brow.sides[k].gapL })),
      lid: lid.map((l) => ({ x: l.x, y: l.y - SUR_EYE_TARGET * base.geom.aper })),
      lip: { x: lip.x, y: lip.y + SUR_MOUTH_TARGET * mouthW },
    },
  }
}

export function evaluateSurprise(base, face, w, h, blend, smooth) {
  const f = faceFrame(face, w, h)
  const bb = base.brow
  const g = browGeom(f)
  const ratio = f.width / base.width
  const pitchRatio = g.vref / bb.vref
  let gateReason = ''
  if (ratio < 0.8 || ratio > 1.25) gateReason = '카메라와의 거리 변화'
  else if (f.yawRatio < 0.6 || f.yawRatio > 1.67) gateReason = '고개 좌우 회전'
  else if (pitchRatio < 0.75 || pitchRatio > 1.33) gateReason = '고개 숙임/듦'
  const gated = !!gateReason

  const r = blend.raw
  const r0 = base.raw
  const L = (i) => f.toLocal(f.P(i))
  const mouthW = Math.abs(L(291).x - L(61).x) || 0.35
  const open = Math.abs(L(SUR.lowerLip).y - L(SUR.upperLip).y) / mouthW

  // 눈썹 올림: browInnerUp + browOuterUp(좌우 평균) / 눈썹-눈꺼풀 간격 증가
  const browBl = clamp01(
    (r.browInnerUp - r0.browInnerUp + (r.browOuterUpL + r.browOuterUpR) / 2 - (r0.browOuterUpL + r0.browOuterUpR) / 2) /
      2 / SUR_BROW_GAIN,
  )
  const browLm = clamp01(
    ([0, 1].reduce((s, k) => s + pos((g.sides[k].gap - bb.sides[k].gap) / bb.sides[k].gap), 0) / 2) / SUR_BROW_UP_TARGET,
  )
  // 눈 크게 뜨기: eyeWide / 눈 열림(눈꺼풀 간격÷얼굴 너비) 증가
  const eyeBl = clamp01(((r.eyeWideL + r.eyeWideR) / 2 - (r0.eyeWideL + r0.eyeWideR) / 2) / SUR_EYE_GAIN)
  const gm = geomOf(f)
  const eyeLm = clamp01(pos((gm.aper - base.geom.aper) / base.geom.aper) / SUR_EYE_TARGET)
  // 입 살짝 벌리기: jawOpen / 윗·아랫입술 간격(입 너비 대비) 증가
  const mouthBl = clamp01((r.jawOpen - r0.jawOpen) / SUR_JAW_GAIN)
  const mouthLm = clamp01(pos(open - base.surprise.open) / SUR_MOUTH_TARGET)

  const part = (bl, lm, w = 1) => clamp01(w * SURPRISE_SCORE_WEIGHT * (SUR_BLEND_WEIGHT * bl + (1 - SUR_BLEND_WEIGHT) * lm))
  const raw = { brow: part(browBl, browLm, SUR_BROW_SCORE_WEIGHT), eye: part(eyeBl, eyeLm, SUR_EYE_SCORE_WEIGHT), mouth: part(mouthBl, mouthLm) }
  if (!gated) {
    for (const k of Object.keys(raw)) {
      smooth[k] = smooth[k] == null ? raw[k] : smooth[k] + 0.4 * (raw[k] - smooth[k])
    }
  }
  const brow = smooth.brow ?? 0
  const eye = smooth.eye ?? 0
  const mouth = smooth.mouth ?? 0
  const overall = SUR_PART_WEIGHT.brow * brow + SUR_PART_WEIGHT.eye * eye + SUR_PART_WEIGHT.mouth * mouth

  let hint
  if (gated) hint = '얼굴을 정면으로 하고, 처음 측정할 때의 거리와 높이를 유지해 주세요.'
  else if (overall < 0.6) hint = '눈썹을 편안하게 조금 올리고, 눈을 부드럽게 크게 떠 보세요.'
  else hint = '좋아요! 눈썹과 눈 주변 움직임이 목표에 가까워졌어요.'

  return {
    f, gated, gateReason, brow, eye, mouth, overall, hint,
    parts: { browBl, browLm, eyeBl, eyeLm, mouthBl, mouthLm },
  }
}
