import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { ALL_FEATURE_INDICES } from './landmarks.js'
import {
  eyeMetric, eyeScore, eyeGeomScore, geomOf, faceFrame, EYE_USE_GEOMETRY, EYE_SMILE_WEIGHT, EYE_POINTS, MEASURE_MS, HOLD_MS, DONE_THRESHOLD,
  readBlend, frameSample, makeBaseline, evaluate,
} from './smile.js'
import Quiz, { Stars } from './Quiz.jsx'
import Face, { QuizFace } from './Faces.jsx'
import Brand from './Brand.jsx'
import Rest from './Rest.jsx'
import { RecordModal, addRecord } from './Record.jsx'
import { GuardianModal } from './Guardian.jsx'
import { FeedbackModal } from './Feedback.jsx'
import { HelpModal } from './Help.jsx'
import { buildFeedback } from './feedback.js'
import { BROW, ANGER_DONE_THRESHOLD, browSample, makeBrowBaseline, evaluateAnger } from './anger.js'
import {
  SUR, SURPRISE_DONE_THRESHOLD, surpriseSample, makeSurpriseBaseline, evaluateSurprise,
} from './surprise.js'

const MIMIC_TOTAL = 5
const REST_HINT_MS = 5 * 60 * 1000 // 카메라를 5분 켜 두면 쉬어가기를 권해요

const ORANGE = '#fb923c'
const GREEN = '#22c55e'
const SOFT = '#fde68a'

function arrow(ctx, from, to, color, lw, head) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x - Math.cos(ang) * head * 0.6, to.y - Math.sin(ang) * head * 0.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - head * Math.cos(ang - 0.45), to.y - head * Math.sin(ang - 0.45))
  ctx.lineTo(to.x - head * Math.cos(ang + 0.45), to.y - head * Math.sin(ang + 0.45))
  ctx.closePath()
  ctx.fill()
}

function dot(ctx, p, r, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
}

// 캔버스는 CSS로 영상과 함께 좌우 반전되므로, 원본 좌표 그대로 그리면 정확히 겹쳐요.
function drawGuides(ctx, base, ev) {
  const { f } = ev
  const W = f.width
  const lw = Math.max(2, W * 0.012)
  // 입꼬리: 현재(주황 점) → 목표(초록 원), 위쪽 방향 화살표
  base.targets.forEach((t, k) => {
    const cur = f.P([61, 291][k])
    const tgt = f.fromLocal(t)
    const r = W * 0.03
    ctx.strokeStyle = GREEN
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (Math.hypot(tgt.x - cur.x, tgt.y - cur.y) > r * 1.2) arrow(ctx, cur, tgt, GREEN, lw, W * 0.04)
    dot(ctx, cur, Math.max(2.5, W * 0.011), ORANGE)
  })
  // 눈 주변: 주요 점 + 볼이 부드럽게 올라가는 방향 표시 (눈을 감거나 찡그릴 필요 없음)
  const up = f.up
  const along = (p, d, s) => ({ x: p.x + up.x * d * s, y: p.y + up.y * d * s })
  for (let k = 0; k < 2; k++) {
    for (const key of ['outer', 'upperLid', 'lowerLid', 'cheek']) {
      dot(ctx, f.P(EYE_POINTS[key][k]), Math.max(2, W * 0.007), '#facc15')
    }
    const cheek = f.P(EYE_POINTS.cheek[k])
    arrow(ctx, cheek, along(cheek, W, 0.06), SOFT, lw * 0.8, W * 0.03)
    const upper = f.P(EYE_POINTS.upperLid[k])
    const lower = f.P(EYE_POINTS.lowerLid[k])
    // 눈이 '부드럽게' 살짝 좁아지는 느낌을 주는 아주 짧은 화살표
    arrow(ctx, along(upper, W, 0.03), along(upper, W, 0.008), SOFT, lw * 0.6, W * 0.015)
    arrow(ctx, along(lower, W, -0.03), along(lower, W, -0.008), SOFT, lw * 0.6, W * 0.015)
  }
}

const DBG_KEYS = [
  ['cheekL', 'cheekSquintLeft'], ['cheekR', 'cheekSquintRight'],
  ['squintL', 'eyeSquintLeft'], ['squintR', 'eyeSquintRight'],
  ['blinkL', 'eyeBlinkLeft'], ['blinkR', 'eyeBlinkRight'],
  ['browL', 'browDownLeft'], ['browR', 'browDownRight'],
]
const f3 = (v) => (v == null ? '-' : v.toFixed(3))

function DebugPanel({ d }) {
  if (!d) return <p className="disclaimer">얼굴이 인식되면 값이 표시돼요.</p>
  const b = d.base
  return (
    <div className="debug">
      <table>
        <thead><tr><th>항목</th><th>기본</th><th>현재</th><th>변화</th><th>연습 중 최대 변화</th></tr></thead>
        <tbody>
          {DBG_KEYS.map(([k, name]) => (
            <tr key={k}>
              <td>{name}</td>
              <td>{f3(b?.raw[k])}</td>
              <td>{f3(d.raw[k])}</td>
              <td>{b ? f3(d.raw[k] - b.raw[k]) : '-'}</td>
              <td>{b ? f3(d.peak[k]) : '-'}</td>
            </tr>
          ))}
          <tr className="sep">
            <td>눈웃음 지표 (0.6·볼 + 0.4·min(눈찡그림, 0.6))</td>
            <td>{f3(b?.eye)}</td><td>{f3(d.eye)}</td>
            <td>{b ? f3(d.eye - b.eye) : '-'}</td><td>{b ? f3(d.peak.eye) : '-'}</td>
          </tr>
        </tbody>
      </table>
      {b && (
        <ul>
          <li>눈웃음 목표 지표값: {f3(b.eyeTarget)} (필요 변화량 {f3(b.eyeTarget - b.eye)})</li>
          <li>현재 눈 점수: 가중치 전 {Math.round(d.eyeRaw * 100)}% → 가중치 ×{EYE_SMILE_WEIGHT} 적용 후 {Math.round(d.eyeWeighted * 100)}%</li>
          <li>최대 변화량 기준: 가중치 전 {Math.round(d.eyePeakScore * 100)}% → 적용 후 {Math.round(d.eyePeakWeighted * 100)}%</li>
          <li className="sep">
            눈 점수 비교 — blendshape 방식(가중치 적용): {Math.round(d.eyeWeighted * 100)}% / 점 위치 방식: {Math.round(d.geomScore * 100)}%
            {' '}→ 실제 반영: {Math.round((EYE_USE_GEOMETRY ? Math.max(d.eyeWeighted, d.geomScore) : d.eyeWeighted) * 100)}% (둘 중 큰 값)
          </li>
          <li>
            눈 열림(눈꺼풀 간격÷얼굴너비): 기본 {f3(b.geom.aper)} → 현재 {f3(d.geom.aper)} ({Math.round((1 - d.geom.aper / b.geom.aper) * 100)}% 감소, 목표 15%)
          </li>
          <li>
            볼-눈꺼풀 간격: 기본 {f3(b.geom.gap)} → 현재 {f3(d.geom.gap)} ({Math.round((1 - d.geom.gap / b.geom.gap) * 100)}% 감소, 목표 12%)
          </li>
          <li>가중치는 민감도를 조절하는 임시 설정이며, 인식 정확도가 좋아졌다는 뜻이 아니에요.</li>
          <li>깜빡임 변화 {f3(d.blink - b.blink)} (0.4 이상이면 눈 점수 0 처리)</li>
          <li>입 미소 지표(참고): 기본 {f3(b.smile)} → 현재 {f3(d.smile)}</li>
        </ul>
      )}
      <p className="disclaimer">
        좌/우는 사진 기준이 아니라 &apos;본인의 왼쪽/오른쪽&apos;이며, 점수는 좌우 평균이라 화면 반전과 무관해요.
        한쪽 눈만 찡그려 보며 해당 줄이 오르는지 확인해 보세요.
      </p>
    </div>
  )
}

// 화남 연습 가이드: 눈썹 현재 위치(주황 점) → 목표(초록 원). 앞머리는 미간 쪽·아래로, 끝부분은 살짝 위로.
// 캔버스가 영상과 함께 CSS로 반전되므로 원본 좌표 그대로 그리면 정확히 겹쳐요.
function drawBrowGuides(ctx, base, ev) {
  const { f } = ev
  const W = f.width
  const lw = Math.max(2, W * 0.012)
  // 하관: 입꼬리는 현재(주황 점) → 약간 아래 목표(초록 원), 나머지는 작은 청록 점
  for (const i of [9, 168, 193, 417]) dot(ctx, f.P(i), Math.max(2, W * 0.006), ORANGE)
  for (const i of BROW.lowerFace.slice(2)) dot(ctx, f.P(i), Math.max(2, W * 0.006), '#22d3ee')
  ;[61, 291].forEach((idx, k) => {
    const cur = f.P(idx)
    const tgt = f.fromLocal(base.brow.mouthTargets[k])
    const r = W * 0.018
    ctx.strokeStyle = GREEN
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (Math.hypot(tgt.x - cur.x, tgt.y - cur.y) > r * 1.2) arrow(ctx, cur, tgt, GREEN, lw, W * 0.03)
    dot(ctx, cur, Math.max(2.5, W * 0.01), ORANGE)
  })
  for (let k = 0; k < 2; k++) {
    // 눈 앞쪽 영역(눈썹 앞머리~눈 안쪽)이 조금 작아지는지 보는 범위를 옅게 표시
    ctx.fillStyle = 'rgba(251, 146, 60, 0.18)'
    ctx.beginPath()
    BROW.areaPoly[k].forEach((i, n) => {
      const p = f.P(i)
      if (n === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.closePath()
    ctx.fill()
    // 눈썹 점은 바깥쪽 끝·중간만 작게 (눈썹 끝은 움직일 필요 없음). 앞머리는 아래에서 크게 표시
    for (const i of [BROW.upperRow[k][0], BROW.upperRow[k][2]]) dot(ctx, f.P(i), Math.max(2, W * 0.006), ORANGE)
    // 눈썹 앞머리: 목표 원 + 화살표 (미간 쪽·아래로)
    const cur = f.P(BROW.inner[k])
    const tgt = f.fromLocal(base.brow.targets[k].inner)
    const r = W * 0.02
    ctx.strokeStyle = GREEN
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (Math.hypot(tgt.x - cur.x, tgt.y - cur.y) > r * 1.2) arrow(ctx, cur, tgt, GREEN, lw, W * 0.035)
    dot(ctx, cur, Math.max(2.5, W * 0.01), ORANGE)
  }
}

// 놀람 연습 가이드: 눈썹 중간·윗눈꺼풀은 위로, 아랫입술 중앙은 살짝 아래로 (현재 주황 점 → 목표 초록 원)
function drawSurpriseGuides(ctx, base, ev) {
  const { f } = ev
  const W = f.width
  const lw = Math.max(2, W * 0.012)
  const guide = (idx, target, r) => {
    const cur = f.P(idx)
    const tgt = f.fromLocal(target)
    ctx.strokeStyle = GREEN
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (Math.hypot(tgt.x - cur.x, tgt.y - cur.y) > r * 1.2) arrow(ctx, cur, tgt, GREEN, lw, W * 0.03)
    dot(ctx, cur, Math.max(2.5, W * 0.01), ORANGE)
  }
  const t = base.surprise.targets
  for (let k = 0; k < 2; k++) {
    guide(SUR.mid[k], t.mid[k], W * 0.02)
    guide(SUR.lid[k], t.lid[k], W * 0.015)
  }
  guide(SUR.lip, t.lip, W * 0.02)
}

function Feedback({ expr, ui }) {
  const { good, tips } = buildFeedback(expr, ui)
  return (
    <div className="feedback">
      {good.map((t) => <p key={t} className="fb-good">✅ {t}</p>)}
      {tips.map((t) => <p key={t} className="fb-tip">💡 {t}</p>)}
    </div>
  )
}

// icon: 글을 읽기 어려운 분도 알 수 있게 라벨 옆에 붙이는 그림. tone: good(초록·긍정) | bad(빨강·부정)
function Meter({ label, value, strong, icon, tone }) {
  const pct = Math.round(value * 100)
  const cls = ['meter', strong && 'strong', tone && 'tone-' + tone].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <div className="meter-head">
        <span>{icon && <span className="meter-icon" aria-hidden="true">{icon}</span>}{label}</span>
        <b>{pct}%</b>
      </div>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

// 얼굴 인식 모델은 사이트에 함께 들어 있어요(public/mediapipe). 센터 네트워크가 외부 주소를 막아도 동작해요.
// 사이트의 파일을 불러오지 못했을 때만 예비로 외부 주소를 써요.
const MODEL_SOURCES = [
  {
    wasm: `${import.meta.env.BASE_URL}mediapipe/wasm`,
    model: `${import.meta.env.BASE_URL}mediapipe/face_landmarker.task`,
  },
  {
    wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
    model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
]

async function createLandmarker() {
  let lastError
  for (const src of MODEL_SOURCES) {
    try {
      const vision = await FilesetResolver.forVisionTasks(src.wasm)
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: src.model, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export default function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  // idle | loading | running | error
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [faceFound, setFaceFound] = useState(false)

  // 표정 연습: off | menu | measuring | practice | done
  const [phase, setPhaseState] = useState('off')
  const [ui, setUi] = useState({ mouth: 0, eye: 0, overall: 0, hint: '', measure: 0, paused: false, browR: 0, browL: 0 })
  const [mode, setMode] = useState('home') // home | practice | quiz
  const [expr, setExpr] = useState('smile') // smile | anger (현재 연습 중인 표정)
  const prRef = useRef({ phase: 'off', samples: [], measured: 0, lastT: 0, base: null, smooth: {}, hold: 0, uiT: 0 })
  const [debugOpen, setDebugOpen] = useState(false)
  const [dbg, setDbg] = useState(null)
  const [adbg, setAdbg] = useState(null)
  const [sdbg, setSdbg] = useState(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [guardianOpen, setGuardianOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const peakRef = useRef({}) // 연습 중 항목별로 가장 크게 감지된 값 (피드백 기준)
  const [fbReady, setFbReady] = useState(false) // 연습 시작 후 잠시 뒤부터 피드백 표시
  const debugOpenRef = useRef(false)
  const setPhase = (p) => {
    const pr = prRef.current
    pr.peak = { eye: 0 }
    if (p === 'practice') peakRef.current = {}
    pr.phase = p
    pr.samples = []
    pr.browSamples = []
    pr.surSamples = []
    pr.measured = 0
    pr.hold = 0
    pr.smooth = {}
    pr.lastT = performance.now()
    // 기본 표정 기준값은 새로 측정을 시작하거나 끌 때만 지우고, 그 외에는 재사용합니다.
    if (p === 'off' || p === 'measuring') pr.base = null
    setPhaseState(p)
    setUi({ mouth: 0, eye: 0, overall: 0, hint: '', measure: 0, paused: false, browR: 0, browL: 0 })
  }

  // 같은 기본 표정 기준값(pr.base)을 재사용해 선택한 표정의 연습을 (다시) 시작
  const startPractice = (which) => {
    prRef.current.expr = which
    setShowHint(false)
    setExpr(which)
    setPhase('practice')
  }

  // ── 표정 지어서 맞추기 퀴즈: 같은 기본 표정 기준값으로 문제 5개를 차례로 풀어요 ──
  const [mq, setMq] = useState({ list: [], index: 0, correct: 0 })
  const [showHint, setShowHint] = useState(false) // 퀴즈에서 힌트 보기를 눌렀을 때만 그림·달성도를 보여 줘요
  const enterMimic = () => {
    const keys = ['smile', 'anger', 'surprise']
    const shuffle = (a) => [...a].sort(() => Math.random() - 0.5)
    const list = [...shuffle(keys), ...shuffle(keys)].slice(0, MIMIC_TOTAL)
    setMq({ list, index: 0, correct: 0 })
    setMode('mimic')
  }
  const startQuestion = () => startPractice(mq.list[mq.index])
  // success=true: 방금 문제를 성공(연습 완료 화면에서 넘어옴), false: 건너뛰기
  const nextQuestion = (success) => {
    const next = { ...mq, index: mq.index + 1, correct: mq.correct + (success ? 1 : 0) }
    setMq(next)
    if (next.index >= next.list.length) setPhase('menu')
    else startPractice(next.list[next.index])
  }

  const stopLoop = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  const stopCamera = useCallback(() => {
    stopLoop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    clearCanvas()
    lastVideoTimeRef.current = -1
    setFaceFound(false)
    setStatus('idle')
    prRef.current.phase = 'off'
    prRef.current.base = null
    setPhaseState('off')
  }, [])

  const stepPractice = (face, result, ctx, canvas) => {
    const pr = prRef.current
    const now = performance.now()
    const dt = Math.min(now - pr.lastT, 100)
    pr.lastT = now
    const blend = face ? readBlend(result) : null
    const ok = !!(face && blend)

    // 디버그: 점수 계산과 무관하게 실측값만 기록 (패널이 열려 있을 때만)
    if (debugOpenRef.current && ok) {
      const b = pr.base
      const eye = eyeMetric(blend)
      const geomNow = geomOf(faceFrame(face, canvas.width, canvas.height))
      if (b && pr.phase === 'practice') {
        pr.peak = pr.peak || { eye: 0 }
        for (const [k] of DBG_KEYS) pr.peak[k] = Math.max(pr.peak[k] ?? -1, blend.raw[k] - b.raw[k])
        pr.peak.eye = Math.max(pr.peak.eye, eye - b.eye)
      }
      if (now - (pr.dbgT || 0) > 100) {
        pr.dbgT = now
        setDbg({
          base: b, raw: blend.raw, eye, blink: blend.blink, smile: blend.smile,
          peak: pr.peak || { eye: 0 },
          eyeRaw: b ? eyeScore(eye, b, 1) : 0,
          eyeWeighted: b ? eyeScore(eye, b) : 0,
          geom: geomNow,
          geomScore: b ? eyeGeomScore(geomNow, b) : 0,
          eyePeakScore: b ? eyeScore(b.eye + (pr.peak?.eye ?? 0), b, 1) : 0,
          eyePeakWeighted: b ? eyeScore(b.eye + (pr.peak?.eye ?? 0), b) : 0,
        })
      }
    }

    if (pr.phase === 'measuring') {
      // 얼굴이 없으면 시간이 흐르지 않고 일시 중단, 다시 인식되면 이어서 진행
      if (ok) {
        pr.measured += dt
        pr.samples.push(frameSample(face, canvas.width, canvas.height, blend))
        pr.browSamples.push(browSample(face, canvas.width, canvas.height))
        pr.surSamples.push(surpriseSample(face, canvas.width, canvas.height))
      }
      if (pr.measured >= MEASURE_MS && pr.samples.length > 0) {
        const base = makeBaseline(pr.samples)
        base.brow = makeBrowBaseline(pr.browSamples)
        base.surprise = makeSurpriseBaseline(pr.surSamples, base)
        setPhase('menu')
        pr.base = base
        return
      }
      if (now - pr.uiT > 100) {
        pr.uiT = now
        setUi((u) => ({ ...u, measure: Math.min(1, pr.measured / MEASURE_MS), paused: !ok }))
      }
    } else if (pr.phase === 'practice' && pr.base) {
      if (!ok) {
        pr.hold = 0
        if (now - pr.uiT > 100) {
          pr.uiT = now
          setUi((u) => ({ ...u, paused: true, hint: '얼굴을 화면 가운데에 맞춰 주세요.' }))
        }
        return
      }
      if (pr.expr === 'anger') {
        const ae = evaluateAnger(pr.base, face, canvas.width, canvas.height, blend, pr.smooth)
        drawBrowGuides(ctx, pr.base, ae)
        if (debugOpenRef.current && now - (pr.adbgT || 0) > 100) {
          pr.adbgT = now
          setAdbg({ parts: ae.parts, gate: ae.gateReason, right: ae.right, left: ae.left, mouth: ae.mouthParts })
        }
        if (!ae.gated && ae.overall >= ANGER_DONE_THRESHOLD) {
          if (!pr.hold) pr.hold = now
          if (now - pr.hold >= HOLD_MS) {
            const base = pr.base
            setPhase('done')
            pr.base = base
            setUi({ browR: ae.right, browL: ae.left, mouthDown: ae.mouthScore, glab: ae.glabScore, overall: ae.overall, hint: '', measure: 0, paused: false })
            return
          }
        } else pr.hold = 0
        if (now - pr.uiT > 100) {
          pr.uiT = now
          setUi({ browR: ae.right, browL: ae.left, mouthDown: ae.mouthScore, glab: ae.glabScore, overall: ae.overall, hint: ae.hint, measure: 0, paused: ae.gated })
        }
        return
      }
      if (pr.expr === 'surprise') {
        const se = evaluateSurprise(pr.base, face, canvas.width, canvas.height, blend, pr.smooth)
        drawSurpriseGuides(ctx, pr.base, se)
        if (debugOpenRef.current && now - (pr.sdbgT || 0) > 100) {
          pr.sdbgT = now
          setSdbg({ parts: se.parts, gate: se.gateReason })
        }
        const vals = { surBrow: se.brow, surEye: se.eye, surMouth: se.mouth, overall: se.overall }
        if (!se.gated && se.overall >= SURPRISE_DONE_THRESHOLD) {
          if (!pr.hold) pr.hold = now
          if (now - pr.hold >= HOLD_MS) {
            const base = pr.base
            setPhase('done')
            pr.base = base
            setUi({ ...vals, hint: '', measure: 0, paused: false })
            return
          }
        } else pr.hold = 0
        if (now - pr.uiT > 100) {
          pr.uiT = now
          setUi({ ...vals, hint: se.hint, measure: 0, paused: se.gated })
        }
        return
      }
      const ev = evaluate(pr.base, face, canvas.width, canvas.height, blend, pr.smooth)
      drawGuides(ctx, pr.base, ev)
      if (!ev.gated && ev.mouth >= DONE_THRESHOLD) {
        if (!pr.hold) pr.hold = now
        if (now - pr.hold >= HOLD_MS) {
          const final = { mouth: ev.mouth, eye: ev.eye, overall: ev.overall }
          const base = pr.base
          setPhase('done')
          pr.base = base
          setUi({ ...final, hint: '', measure: 0, paused: false })
          return
        }
      } else pr.hold = 0
      if (now - pr.uiT > 100) {
        pr.uiT = now
        setUi({ mouth: ev.mouth, eye: ev.eye, overall: ev.overall, hint: ev.hint, measure: 0, paused: ev.gated })
      }
    }
  }

  const draw = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker || !streamRef.current) return

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight

      const result = landmarker.detectForVideo(video, performance.now())
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const face = result.faceLandmarks[0]
      setFaceFound(!!face)
      // 연습 중(연습·완료 화면)에는 화면이 복잡하지 않도록 기본 청록 점을 숨기고 연습용 가이드만 보여줘요.
      const inPractice = prRef.current.phase === 'practice' || prRef.current.phase === 'done'
      if (face && !inPractice) {
        ctx.fillStyle = '#22d3ee'
        for (const i of ALL_FEATURE_INDICES) {
          const p = face[i]
          ctx.beginPath()
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      stepPractice(face, result, ctx, canvas)
    }
    rafRef.current = requestAnimationFrame(draw)
  }, [])

  const startCamera = async () => {
    setStatus('loading')
    setMessage('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않아요.')
      }

      // 얼굴 인식 모델은 처음 한 번만 불러옵니다. (영상이 아니라 모델 파일만 불러와요)
      if (!landmarkerRef.current) {
        landmarkerRef.current = await createLandmarker()
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      setStatus('running')
      rafRef.current = requestAnimationFrame(draw)
    } catch (err) {
      stopCamera()
      setStatus('error')
      if (err?.name === 'NotAllowedError') {
        setMessage('카메라 사용이 허용되지 않았어요. 주소창의 카메라 아이콘에서 허용해 주세요.')
      } else if (err?.name === 'NotFoundError') {
        setMessage('연결된 카메라를 찾을 수 없어요.')
      } else {
        setMessage(err?.message || '카메라를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }
  }

  // 연습 중 항목별 최대값 기록 → 피드백은 '지금까지 가장 크게 감지된 움직임' 기준이라 깜빡이지 않아요
  useEffect(() => {
    if (phase !== 'practice' && phase !== 'done') return
    const peak = peakRef.current
    for (const [k, v] of Object.entries(ui)) {
      if (typeof v === 'number') peak[k] = Math.max(peak[k] ?? 0, v)
    }
  }, [ui, phase])

  // 연습을 시작하고 3초 뒤부터 피드백을 보여줘요 (움직일 시간을 주기 위해)
  useEffect(() => {
    if (phase === 'done') {
      setFbReady(true)
      return undefined
    }
    setFbReady(false)
    if (phase !== 'practice') return undefined
    const t = setTimeout(() => setFbReady(true), 3000)
    return () => clearTimeout(t)
  }, [phase])

  // 연습을 완료하면 (로그인한 경우에만) 날짜·표정·달성도를 이 기기에 기록. 영상·얼굴 정보는 저장하지 않아요.
  useEffect(() => {
    if (phase !== 'done') return
    addRecord({ expr, score: Math.min(1, ui.overall ?? 0), kind: mode === 'mimic' ? 'quiz' : 'practice' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 페이지를 떠날 때 카메라와 모델 정리
  useEffect(() => {
    return () => {
      stopLoop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const running = status === 'running'
  const loading = status === 'loading'

  // 카메라를 오래 켜 두면 "쉬어갈까요?" 하고 부드럽게 권해요. 소리도 깜빡임도 없이 작은 안내만 나와요.
  const [restHint, setRestHint] = useState(false)
  const [restCycle, setRestCycle] = useState(0)
  useEffect(() => {
    if (!running) {
      setRestHint(false)
      return undefined
    }
    const id = setTimeout(() => setRestHint(true), REST_HINT_MS)
    return () => clearTimeout(id)
  }, [running, restCycle])

  // 오른쪽 위에 항상 떠 있는 '좋아하는 것(안정)' 바로가기. 어느 화면에서든 한 번에 쉬어가기로 가요.
  const calmBtn = (
    <button
      className="calm-fab"
      onClick={() => {
        stopCamera()
        setMode('rest')
      }}
      aria-label="안정 · 좋아하는 것 바로가기"
      title="힘들면 눌러요"
    >
      <span aria-hidden="true">⏸️</span>
      <small>안정</small>
    </button>
  )

  // 첫 화면: 표정 연습해보기 / 표정 퀴즈 맞추기
  if (mode === 'home') {
    return (
      <main className="app home-screen">
        {calmBtn}
        <Brand />
        <p className="home-intro">표정을 보고, 따라 하고, 맞춰 봐요.</p>

        <div className="home-cards">
          <button className="home-card practice" onClick={() => setMode('practice')} aria-label="표정 연습">
            <span className="home-icons" aria-hidden="true">📷</span>
            <img className="home-card-logo" src={`${import.meta.env.BASE_URL}logo/facemate-logo.png`} alt="" aria-hidden="true" />
            <span className="home-card-title">표정 연습</span>
          </button>
          <button className="home-card quiz" onClick={() => setMode('quizMenu')} aria-label="표정 퀴즈">
            <span className="home-icons" aria-hidden="true">❓</span>
            <img className="home-card-logo" src={`${import.meta.env.BASE_URL}logo/facemate-logo-o.png`} alt="" aria-hidden="true" />
            <span className="home-card-title">표정 퀴즈</span>
          </button>
        </div>

        <div className="home-safe" aria-label="안심 안내">
          <div className="icon-item">
            <button className="icon-box help" onClick={() => setHelpOpen(true)} aria-label="설명 보기" title="사용 방법">❓</button>
            <span className="icon-label">설명</span>
          </div>
          <div className="icon-item">
            <button className="icon-box privacy" onClick={() => setGuardianOpen(true)} aria-label="개인정보 · 보호자 설정" title="보호자만 열 수 있어요"><span className="p-person">👤</span><span className="p-lock">🔒</span></button>
            <span className="icon-label">개인정보</span>
          </div>
          <div className="icon-item">
            <button className="icon-box pause" onClick={() => setMode('rest')} aria-label="쉬어가기 · 마음 가라앉히기" title="언제든 쉬어도 돼요">⏸️</button>
            <span className="icon-label">쉬어가기</span>
          </div>
          <div className="icon-item">
            <button className="icon-box heart" onClick={() => setRecordOpen(true)} aria-label="학습 기록 · 로그인">❤️</button>
            <span className="icon-label">내 기록</span>
          </div>
        </div>

        <p className="home-privacy">
          👤🔒 개인정보 안내<br />
          카메라 영상과 얼굴 정보는 이 기기 안에서만 사용돼요.<br />
          서버로 보내지 않고, 영상·얼굴 정보는 저장하지 않아요.<br />
          ❤️ 연습 기록(날짜·점수)은 로그인하면 이 기기에만 저장돼요.
        </p>
        <p className="home-feedback">
          <button className="link" onClick={() => setFeedbackOpen(true)}>의견 보내기 (기능 추가 · 불편한 점)</button>
          {' · '}
          <a className="link" href="/readme.md" target="_blank" rel="noreferrer">README 보기</a>
        </p>
        {recordOpen && <RecordModal onClose={() => setRecordOpen(false)} />}
        {guardianOpen && <GuardianModal onClose={() => setGuardianOpen(false)} />}
        {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </main>
    )
  }
  if (mode === 'rest') {
    return (
      <main className="app">
        <Brand />
        <Rest onExit={() => setMode('home')} />
      </main>
    )
  }
  if (mode === 'quizMenu') {
    return (
      <main className="app">
        {calmBtn}
        <Brand />
        <p className="subtitle">어떤 퀴즈를 풀어 볼까요?</p>
        <div className="home">
          <button onClick={() => setMode('quizBasic')}>기초 · 긍정 / 부정 고르기 🟢🔴</button>
          <button onClick={() => setMode('quizPick')}>1단계 · 이모지 맞추기 😊</button>
          <button onClick={() => setMode('quizPhoto')}>2단계 · 사진 보고 맞추기 🖼️</button>
          <button onClick={enterMimic}>표정 지어서 맞추기 📷</button>
          <button className="ghost" onClick={() => setMode('home')}>← 처음으로</button>
        </div>
      </main>
    )
  }
  if (mode === 'quizBasic' || mode === 'quizPick' || mode === 'quizPhoto') {
    return (
      <main className="app">
        {calmBtn}
        <Brand />
        <Quiz key={mode} level={mode === 'quizBasic' ? 0 : mode === 'quizPhoto' ? 2 : 1} onExit={() => setMode('quizMenu')} />
        <p><button className="ghost" onClick={() => setMode('home')}>🏠 처음으로</button></p>
      </main>
    )
  }

  // 긍정(미소)은 초록, 부정(화남)은 빨강 테두리. 달성도가 높을수록 진해지고, 깜빡이거나 움직이지 않아요.
  const glowRgb = expr === 'smile' ? '34,197,94' : expr === 'anger' ? '239,68,68' : null
  const glow =
    running && glowRgb && (phase === 'practice' || phase === 'done')
      ? { boxShadow: '0 0 0 6px rgba(' + glowRgb + ',' + (0.25 + 0.75 * Math.min(1, ui.overall || 0)).toFixed(2) + ')' }
      : undefined

  return (
    <main className="app">
      {calmBtn}
      <Brand />
      <p className="subtitle">내 얼굴 표정을 직접 보며 연습해 보세요.</p>
      <p>
        <button
          className="ghost"
          onClick={() => {
            stopCamera() // 처음으로 돌아가면 카메라도 꺼요
            setMode(mode === 'mimic' ? 'quizMenu' : 'home')
          }}
        >
          ← {mode === 'mimic' ? '퀴즈 선택으로' : '처음으로'}
        </button>
        {mode === 'mimic' && (
          <>
            {' '}
            <button
              className="ghost"
              onClick={() => {
                stopCamera()
                setMode('home')
              }}
            >
              🏠 처음으로
            </button>
          </>
        )}
      </p>

      <div className="stage" style={glow}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {running && mode !== 'mimic' && ((phase === 'practice' && fbReady) || phase === 'done') && (
          <div className="stage-feedback"><Feedback expr={expr} ui={peakRef.current} /></div>
        )}
        {running && mode === 'mimic' && phase === 'practice' && (
          <div className="stage-word">
            {{ smile: '미소 😊', anger: '화남 😠', surprise: '놀람 😮' }[expr]}
          </div>
        )}
        {!running && (
          <div className="placeholder">
            {loading ? (
              '준비 중이에요… 잠시만 기다려 주세요.'
            ) : (
              <div className="placeholder-box">
                <div className="placeholder-emoji" aria-hidden="true">😐</div>
                <div>카메라를 시작해 주세요.</div>
                <div>시작하기 전에 편안한 표정을 지어 주세요</div>
              </div>
            )}
          </div>
        )}
      </div>


      <div className="controls">
        {running ? (
          <button className="stop" onClick={stopCamera}>카메라 정지</button>
        ) : (
          <button onClick={startCamera} disabled={loading}>
            {loading ? '⏳ 준비 중…' : '📷 카메라 시작'}
          </button>
        )}
      </div>

      {running && restHint && (
        <div className="rest-hint" role="status">
          <p><span aria-hidden="true">🌿</span> 오래 했어요. 잠깐 쉬어갈까요?</p>
          <button
            onClick={() => {
              stopCamera()
              setMode('rest')
            }}
          >
            ⏸️ 쉬어가기
          </button>{' '}
          <button
            className="ghost"
            onClick={() => {
              setRestHint(false)
              setRestCycle((c) => c + 1)
            }}
          >
            계속하기
          </button>
        </div>
      )}

      {running && (
        <section className="practice">
          {phase === 'off' && <button onClick={() => setPhase('measuring')}>▶️ 표정 연습 시작</button>}
          {phase === 'menu' && mode === 'mimic' && (
            <div>
              {mq.index >= mq.list.length ? (
                <>
                  <Stars correct={mq.correct} total={mq.list.length} />
                  <button onClick={enterMimic}>다시 ↻</button>
                </>
              ) : (
                <>
                  <p className="notice">{mq.index + 1} / {mq.list.length} 번째 문제</p>
                  <button onClick={startQuestion}>▶</button>
                </>
              )}
              <p><button className="ghost" onClick={() => setPhase('measuring')}>기본 표정 다시 측정</button></p>
            </div>
          )}
          {phase === 'menu' && mode !== 'mimic' && (
            <div>
              <p className="notice">연습할 표정을 선택해 주세요.</p>
              <button onClick={() => startPractice('smile')}>미소 😊</button>{' '}
              <button onClick={() => startPractice('anger')}>화남 😠</button>{' '}
              <button onClick={() => startPractice('surprise')}>놀람 😮</button>
              <p><button className="ghost" onClick={() => setPhase('measuring')}>기본 표정 다시 측정</button></p>
            </div>
          )}
          {phase === 'measuring' && (
            <div>
              <p className="notice">편안한 표정을 측정 중입니다</p>
              <p className="notice">{Math.max(0, Math.ceil((1 - ui.measure) * (MEASURE_MS / 1000)))}초</p>
              <div className="bar"><span style={{ width: `${ui.measure * 100}%` }} /></div>
              {ui.paused && <p className="error">얼굴이 인식되지 않아 잠시 멈췄어요. 화면 가운데에 맞춰 주세요.</p>}
            </div>
          )}
          {phase === 'practice' && (
            <div>
              {mode === 'mimic' && (
                <>
                  <p className="notice">{mq.index + 1} / {mq.list.length}</p>
                  <p>
                    <button className="ghost" onClick={() => setShowHint((s) => !s)}>
                      💡 {showHint ? '힌트 숨기기' : '힌트 보기'}
                    </button>
                  </p>
                  {showHint && <div className="quiz-emoji"><QuizFace type={expr} variant={mq.index % 3} size={160} /></div>}
                </>
              )}
              {(mode !== 'mimic' || showHint) && (expr === 'smile' ? (
                <>
                  <Meter icon="👄" tone="good" label="입 미소 달성도" value={ui.mouth} />
                  <Meter icon="👁️" tone="good" label="눈웃음 달성도 (선택)" value={ui.eye} />
                  <Meter icon="😊" tone="good" label="전체 미소 달성도" value={ui.overall} strong />
                </>
              ) : expr === 'surprise' ? (
                <>
                  <Meter icon="🤨" label="눈썹 올림 달성도" value={ui.surBrow ?? 0} />
                  <Meter icon="👀" label="눈 크게 뜨기 달성도" value={ui.surEye ?? 0} />
                  <Meter icon="👄" label="입 살짝 벌리기 달성도" value={ui.surMouth ?? 0} />
                  <Meter icon="😮" label="전체 놀람 표정 움직임 달성도" value={ui.overall} strong />
                </>
              ) : (
                <>
                  <Meter icon="🤨" tone="bad" label="오른쪽 눈썹 달성도" value={ui.browR} />
                  <Meter icon="🤨" tone="bad" label="왼쪽 눈썹 달성도" value={ui.browL} />
                  <Meter icon="👄" tone="bad" label="입꼬리 내려감 달성도 (참고)" value={ui.mouthDown ?? 0} />
                  <Meter icon="😠" tone="bad" label="미간 모임 달성도 (참고)" value={ui.glab ?? 0} />
                  <Meter icon="😠" tone="bad" label="전체 눈썹 움직임 달성도" value={ui.overall} strong />
                </>
              ))}
              {mode !== 'mimic' && <p className="notice">{ui.hint}</p>}
              {mode === 'mimic' ? (
                <button className="ghost" onClick={() => nextQuestion(false)}>건너뛰기</button>
              ) : (
                expr !== 'smile' && <button className="ghost" onClick={() => setPhase('menu')}>그만하기</button>
              )}
            </div>
          )}
          {phase === 'done' && (
            <div>
              <p className="done">
                {mode === 'mimic'
                  ? '⭕ 👏'
                  : '연습 완료! 🎉'}
              </p>
              {(expr === 'smile' || expr === 'anger') && (
                <p className={'valence ' + (expr === 'smile' ? 'good' : 'bad')}>
                  {expr === 'smile' ? '🟢 긍정 표정 😊' : '🔴 부정 표정 😠'}
                </p>
              )}
              {expr === 'smile' ? (
                <>
                  <Meter icon="👄" tone="good" label="입 미소 달성도" value={ui.mouth} />
                  <Meter icon="👁️" tone="good" label="눈웃음 달성도 (선택)" value={ui.eye} />
                  <Meter icon="😊" tone="good" label="전체 미소 달성도" value={ui.overall} strong />
                </>
              ) : expr === 'surprise' ? (
                <>
                  <Meter icon="🤨" label="눈썹 올림 달성도" value={ui.surBrow ?? 0} />
                  <Meter icon="👀" label="눈 크게 뜨기 달성도" value={ui.surEye ?? 0} />
                  <Meter icon="👄" label="입 살짝 벌리기 달성도" value={ui.surMouth ?? 0} />
                  <Meter icon="😮" label="전체 놀람 표정 움직임 달성도" value={ui.overall} strong />
                </>
              ) : (
                <>
                  <Meter icon="🤨" tone="bad" label="오른쪽 눈썹 달성도" value={ui.browR} />
                  <Meter icon="🤨" tone="bad" label="왼쪽 눈썹 달성도" value={ui.browL} />
                  <Meter icon="👄" tone="bad" label="입꼬리 내려감 달성도 (참고)" value={ui.mouthDown ?? 0} />
                  <Meter icon="😠" tone="bad" label="미간 모임 달성도 (참고)" value={ui.glab ?? 0} />
                  <Meter icon="😠" tone="bad" label="전체 눈썹 움직임 달성도" value={ui.overall} strong />
                </>
              )}
              {mode === 'mimic' && (
                <p>
                  <button onClick={() => nextQuestion(true)}>
                    {mq.index + 1 >= mq.list.length ? '결과' : '다음 ▶'}
                  </button>
                </p>
              )}
              {mode !== 'mimic' && <button onClick={() => startPractice(expr)}>다시 연습하기</button>}
              {mode !== 'mimic' && <p>
                <button className="ghost" onClick={() => setPhase('menu')}>표정 선택으로 돌아가기</button>{' '}
                <button className="ghost" onClick={() => setPhase('measuring')}>기본 표정 다시 측정</button>
              </p>}
            </div>
          )}
          {(phase === 'practice' || phase === 'done') && (
            <p className="disclaimer">
              {expr === 'smile'
                ? '이 점수는 감정이나 사회적 능력을 평가하는 것이 아니라, 표정 움직임의 연습 달성도예요. 불편하면 무리하지 말고 편안한 만큼만 해 보세요.'
                : expr === 'surprise'
                  ? '이 점수는 감정을 판단하는 것이 아니라, 놀람과 관련된 표정 움직임의 연습 달성도예요. 눈을 크게 뜨는 게 불편하면 언제든 그만해도 괜찮아요.'
                  : '이 점수는 감정을 판단하는 것이 아니라, 화남과 관련된 눈썹 움직임의 연습 달성도예요. 눈썹에 힘을 주는 게 불편하면 언제든 그만해도 괜찮아요.'}
            </p>
          )}
        </section>
      )}

      {running && (
        <section className="practice">
          <button
            className="ghost"
            onClick={() => {
              debugOpenRef.current = !debugOpen
              setDebugOpen(!debugOpen)
            }}
          >
            {debugOpen ? '디버그 닫기' : '디버그 열기'}
          </button>
          {debugOpen && <DebugPanel d={dbg} />}
          {debugOpen && expr === 'surprise' && phase === 'practice' && sdbg && (
            <div className="debug">
              <p className="sep">놀람 연습 분석 (파트 점수 = blendshape 70% + Landmark 30%, 가중치 적용 전 값)</p>
              {sdbg.gate && <p className="error">점수 갱신 멈춤: {sdbg.gate}</p>}
              <table>
                <thead><tr><th>파트</th><th>blendshape</th><th>Landmark</th></tr></thead>
                <tbody>
                  <tr><td>눈썹 올림</td><td>{Math.round(sdbg.parts.browBl * 100)}%</td><td>{Math.round(sdbg.parts.browLm * 100)}%</td></tr>
                  <tr><td>눈 크게 뜨기</td><td>{Math.round(sdbg.parts.eyeBl * 100)}%</td><td>{Math.round(sdbg.parts.eyeLm * 100)}%</td></tr>
                  <tr><td>입 살짝 벌리기</td><td>{Math.round(sdbg.parts.mouthBl * 100)}%</td><td>{Math.round(sdbg.parts.mouthLm * 100)}%</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {debugOpen && expr === 'anger' && phase === 'practice' && adbg && (
            <div className="debug">
              <p className="sep">화남 연습 분석 (각 항목 0~100%, 점수 = blendshape 70% + Landmark 30%)</p>
              {adbg.gate && <p className="error">점수 갱신 멈춤: {adbg.gate}</p>}
              <table>
                <thead><tr><th>눈썹</th><th>browDown</th><th>간격 감소</th><th>앞머리 모임</th><th>눈앞쪽 면적 감소</th><th>점수</th></tr></thead>
                <tbody>
                  {['오른쪽', '왼쪽'].map((name, k) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{Math.round(adbg.parts[k].bl * 100)}%</td>
                      <td>{Math.round(adbg.parts[k].drop * 100)}%</td>
                      <td>{Math.round(adbg.parts[k].conv * 100)}%</td>
                      <td>{Math.round(adbg.parts[k].area * 100)}%</td>
                      <td>{Math.round((k === 0 ? adbg.right : adbg.left) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>입꼬리 내려감: Landmark {Math.round(adbg.mouth.cornerDrop * 100)}% / mouthFrown {Math.round(adbg.mouth.frown * 100)}% (두 값 평균이 점수의 16%에 반영)</p>
              <p>미간 모임: 세로 {Math.round(adbg.mouth.glabV * 100)}% / 가로 {Math.round(adbg.mouth.glabH * 100)}% (평균이 점수의 16%에 반영)</p>
            </div>
          )}
        </section>
      )}

      {running && (
        <p className="status">
          {faceFound ? '얼굴이 인식되었어요 ✅' : '얼굴을 화면 가운데에 맞춰 주세요.'}
        </p>
      )}
      {message && <p className="error">{message}</p>}

      <p className="privacy">
        🔒 얼굴 영상은 이 기기 안에서만 처리되며 서버로 전송되거나 저장되지 않아요.
      </p>
    </main>
  )
}
