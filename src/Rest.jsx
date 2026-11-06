import { useEffect, useState } from 'react'
import { loadFavorite } from './Guardian.jsx'

// 쉬어가기: 긴장·흥분을 가라앉히는 화면. 소리·깜빡임·점수·시간 제한이 없고, 언제든 돌아갈 수 있어요.
// 모든 것이 예측 가능해요: 숨쉬기는 들이쉬기 4초 → 내쉬기 6초가 계속 반복되고, 숫자로 남은 시간을 보여 줘요.
const IN_SEC = 4
const OUT_SEC = 6

const GROUND_STEPS = [
  { icon: '👀', text: '눈에 보이는 것 3가지를 마음속으로 말해 봐요.' },
  { icon: '👂', text: '들리는 소리 2가지를 찾아봐요.' },
  { icon: '🤲', text: '손에 닿는 것 1가지를 가만히 만져 봐요.' },
  { icon: '🌿', text: '잘했어요. 지금 여기에 있어요.' },
]

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function Breathing({ still }) {
  // 순수한 상태 갱신(개발 모드에서 두 번 실행돼도 안전): phase = in(들이쉬기) | out(내쉬기)
  const [{ phase, left }, setState] = useState({ phase: 'in', left: IN_SEC })

  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        if (s.left > 1) return { phase: s.phase, left: s.left - 1 }
        return s.phase === 'in' ? { phase: 'out', left: OUT_SEC } : { phase: 'in', left: IN_SEC }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const big = phase === 'in'
  const style = still
    ? { transform: 'scale(0.85)', transition: 'none' }
    : { transform: `scale(${big ? 1 : 0.55})`, transition: `transform ${big ? IN_SEC : OUT_SEC}s ease-in-out` }

  return (
    <div className="rest-breath">
      <div className="breath-circle" style={style} aria-hidden="true" />
      <p className="breath-text" aria-live="off">{big ? '들이마셔요' : '천천히 내쉬어요'}</p>
      <p className="breath-count">{left}</p>
    </div>
  )
}

function Grounding() {
  const [i, setI] = useState(0)
  const step = GROUND_STEPS[i]
  const last = i === GROUND_STEPS.length - 1
  return (
    <div className="rest-ground">
      <p className="ground-icon" aria-hidden="true">{step.icon}</p>
      <p className="ground-text">{step.text}</p>
      <p className="ground-dots" aria-hidden="true">
        {GROUND_STEPS.map((_, k) => (k === i ? '●' : '○')).join(' ')}
      </p>
      <p>
        {!last ? (
          <button onClick={() => setI(i + 1)}>다 했어요 ▶</button>
        ) : (
          <button className="ghost" onClick={() => setI(0)}>처음부터 다시</button>
        )}
      </p>
    </div>
  )
}

// 보호자가 미리 정해 둔 '좋아하는 것'. 깜빡임·소리 없이 같은 자리에서 천천히 바뀌어요.
function Favorite({ fav }) {
  const [n, setN] = useState(1)
  const isCount = fav.type === 'count'

  useEffect(() => {
    if (!isCount) return undefined
    const id = setInterval(() => setN((v) => (v >= fav.max ? 1 : v + 1)), 2000)
    return () => clearInterval(id)
  }, [isCount, fav.max])

  return (
    <div className="rest-fav">
      <p className="fav-main" aria-live="off">{isCount ? n : fav.text}</p>
      {isCount && <p className="disclaimer">1부터 {fav.max}까지 천천히 세어요.</p>}
    </div>
  )
}

export default function Rest({ onExit }) {
  const fav = loadFavorite()
  const [tool, setTool] = useState(fav ? 'fav' : 'breath') // fav | breath | ground
  const [still, setStill] = useState(prefersReducedMotion)

  return (
    <section className="rest">
      <p className="rest-hello">긴장되거나 들뜰 때, 천천히 쉬어 가요.</p>

      <div className="rest-tabs">
        {fav && (
          <>
            <button className={tool === 'fav' ? '' : 'ghost'} onClick={() => setTool('fav')}>좋아하는 것</button>{' '}
          </>
        )}
        <button className={tool === 'breath' ? '' : 'ghost'} onClick={() => setTool('breath')}>숨쉬기</button>{' '}
        <button className={tool === 'ground' ? '' : 'ghost'} onClick={() => setTool('ground')}>지금 여기 찾기</button>
      </div>

      {tool === 'fav' && fav ? <Favorite fav={fav} /> : tool === 'breath' ? <Breathing still={still} /> : <Grounding />}

      <p>
        <button className="ghost" onClick={() => setStill((s) => !s)}>
          {still ? '움직임 켜기' : '움직임 줄이기'}
        </button>
      </p>
      <p><button onClick={onExit}>준비되면 돌아가기</button></p>
      <p className="disclaimer">시간 제한도 점수도 없어요. 언제든 돌아가도 돼요.</p>
    </section>
  )
}
