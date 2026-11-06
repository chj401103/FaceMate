// 점수 계산의 기본 성질을 확인하는 자동 테스트 (실행: npm test)
// 카메라 없이, 손으로 만든 얼굴 좌표와 blendshape 값으로 순수 계산 함수만 시험해요.
// 실제 사람 얼굴로 잰 검증이 아니라 '계산이 설계대로 움직이는지'를 보는 시험입니다.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  frameSample, makeBaseline, evaluate, eyeScore, eyeGeomScore, geomOf, faceFrame,
  EYE_SMILE_WEIGHT,
} from '../src/smile.js'

// ── 손으로 만든 얼굴: 필요한 점만 의미 있게 놓고 나머지는 가운데에 둬요 ──
function makeFace({ scale = 1, noseX = 0.5 } = {}) {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const set = (i, x, y) => { face[i] = { x, y, z: 0 } }
  const half = 0.25 * scale
  set(234, 0.5 - half, 0.5) // 얼굴 왼쪽 끝
  set(454, 0.5 + half, 0.5) // 얼굴 오른쪽 끝
  set(1, noseX, 0.55) // 코끝
  set(61, 0.5 - 0.09 * scale, 0.68); set(291, 0.5 + 0.09 * scale, 0.68) // 입꼬리
  // 눈: 윗눈꺼풀 / 아랫눈꺼풀 / 볼 (오른쪽 눈·왼쪽 눈)
  set(159, 0.5 - 0.1 * scale, 0.42); set(145, 0.5 - 0.1 * scale, 0.45); set(50, 0.5 - 0.12 * scale, 0.52)
  set(386, 0.5 + 0.1 * scale, 0.42); set(374, 0.5 + 0.1 * scale, 0.45); set(280, 0.5 + 0.12 * scale, 0.52)
  return face
}

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || '') + ` 값 ${a}, 기대 ${b}`)

const RAW = {
  cheekL: 0, cheekR: 0, squintL: 0, squintR: 0, blinkL: 0, blinkR: 0, browL: 0, browR: 0,
  mouthFrownL: 0, mouthFrownR: 0, browInnerUp: 0, browOuterUpL: 0, browOuterUpR: 0,
  eyeWideL: 0, eyeWideR: 0, jawOpen: 0,
}
const blend = ({ smile = 0.1, cheek = 0.1, squint = 0.1, blink = 0.05 } = {}) => ({ raw: RAW, smile, cheek, squint, blink })

// 편안한 기본 표정 2초(여기서는 여러 프레임) 평균으로 기준값을 만들어요.
function baselineOf(face = makeFace(), b = blend()) {
  const samples = Array.from({ length: 10 }, () => frameSample(face, 1, 1, b))
  return makeBaseline(samples)
}

test('기본 표정 그대로면 점수는 0이에요 (움직이지 않으면 점수가 오르지 않음)', () => {
  const base = baselineOf()
  const r = evaluate(base, makeFace(), 1, 1, blend(), {})
  assert.equal(r.gated, false)
  near(r.mouth, 0, '입')
  near(r.eye, 0, '눈')
  near(r.overall, 0, '전체')
})

test('입꼬리 미소가 목표에 닿으면 입 점수는 100%예요', () => {
  const base = baselineOf()
  const r = evaluate(base, makeFace(), 1, 1, blend({ smile: base.smileTarget }), {})
  assert.ok(Math.abs(r.mouth - 1) < 1e-9, '입 점수 ' + r.mouth)
})

test('목표의 절반만 움직이면 입 점수는 약 50%예요 (기준 대비 비례)', () => {
  const base = baselineOf()
  const half = base.smile + (base.smileTarget - base.smile) / 2
  const r = evaluate(base, makeFace(), 1, 1, blend({ smile: half }), {})
  assert.ok(Math.abs(r.mouth - 0.5) < 1e-9, '입 점수 ' + r.mouth)
})

test('미소 목표는 무리하지 않는 작은 변화예요 (기본값에서 +0.15 ~ +0.35)', () => {
  for (const s of [0, 0.1, 0.3, 0.6, 0.9]) {
    const base = baselineOf(makeFace(), blend({ smile: s }))
    const gain = base.smileTarget - base.smile
    assert.ok(gain >= 0.15 - 1e-9 && gain <= 0.35 + 1e-9, `기본 ${s} → 필요한 상승 ${gain}`)
  }
})

test('눈웃음 가중치: 같은 변화에서 가중치 2.0은 1.0보다 2배(최대 100%)로 나와요', () => {
  const base = baselineOf()
  const metric = base.eye + 0.05 // 목표(+0.2)의 25%만큼 움직임
  const w1 = eyeScore(metric, base, 1)
  const w2 = eyeScore(metric, base) // 기본 가중치
  assert.equal(EYE_SMILE_WEIGHT, 2.0)
  assert.ok(Math.abs(w1 - 0.25) < 1e-9)
  assert.ok(Math.abs(w2 - 0.5) < 1e-9)
  assert.equal(eyeScore(base.eye + 5, base), 1) // 100%를 넘지 않음
  near(eyeScore(base.eye - 5, base), 0, '하한') // 0% 아래로 내려가지 않음
})

test('눈 신호(blendshape)가 약한 사람도 점 위치로 눈웃음을 잴 수 있어요', () => {
  const base = baselineOf()
  // 눈이 15% 줄고 볼-눈꺼풀 간격이 12% 줄어든 얼굴 (blendshape는 그대로)
  const f = makeFace()
  const cur = geomOf(faceFrame(f, 1, 1))
  const squeezed = { aper: cur.aper * 0.85, gap: cur.gap * 0.88 }
  assert.ok(Math.abs(eyeGeomScore(squeezed, base) - 1) < 1e-9)
  near(eyeGeomScore(cur, base), 0, '변화 없음') // 변화가 없으면 0
})

test('눈을 감는 쪽(깜빡임 증가)으로는 눈웃음 점수가 오르지 않아요', () => {
  const base = baselineOf()
  const b = blend({ cheek: 0.9, squint: 0.9, blink: base.blink + 0.5 })
  const r = evaluate(base, makeFace(), 1, 1, b, {})
  near(r.eye, 0, '깜빡임 증가 시 눈웃음')
})

test('카메라와의 거리가 크게 바뀌면 채점을 멈춰요 (0.8배 미만 · 1.25배 초과)', () => {
  const base = baselineOf()
  const far = evaluate(base, makeFace({ scale: 0.7 }), 1, 1, blend({ smile: base.smileTarget }), {})
  const near = evaluate(base, makeFace({ scale: 1.4 }), 1, 1, blend({ smile: base.smileTarget }), {})
  const ok = evaluate(base, makeFace({ scale: 1.1 }), 1, 1, blend({ smile: base.smileTarget }), {})
  assert.equal(far.gated, true)
  assert.equal(near.gated, true)
  assert.equal(ok.gated, false)
  assert.match(far.hint, /정면/)
})

test('고개를 크게 돌리면 채점을 멈춰요 (코 위치 좌우 비율)', () => {
  const base = baselineOf()
  const turned = evaluate(base, makeFace({ noseX: 0.7 }), 1, 1, blend({ smile: base.smileTarget }), {})
  assert.equal(turned.gated, true)
})

test('멈춘 동안에는 점수가 오르지 않아요 (이전 값 유지)', () => {
  const base = baselineOf()
  const smooth = {}
  evaluate(base, makeFace(), 1, 1, blend({ smile: base.smileTarget }), smooth) // 1프레임: 점수 100%
  const during = evaluate(base, makeFace({ scale: 1.5 }), 1, 1, blend({ smile: 0 }), smooth)
  assert.equal(during.gated, true)
  assert.ok(Math.abs(during.mouth - 1) < 1e-9)
})

test('모든 점수는 0~100% 안에 있어요', () => {
  const base = baselineOf()
  for (const s of [-1, 0, 0.2, 0.5, 1, 3]) {
    const r = evaluate(base, makeFace(), 1, 1, blend({ smile: s, cheek: s, squint: s }), {})
    for (const v of [r.mouth, r.eye, r.overall]) assert.ok(v >= 0 && v <= 1, `값 ${v} (입력 ${s})`)
  }
})
