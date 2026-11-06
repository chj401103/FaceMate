import { useState } from 'react'
import Face, { FACE_TYPES, FACE_VARIANTS, PHOTO_LIST, QuizFace } from './Faces.jsx'

// 표정 보고 맞추는 퀴즈. 카메라를 쓰지 않고, 아무 데도 저장하거나 전송하지 않아요.
// 기초: 😊 긍정 / 😠 부정 두 가지만 골라요. (이 앱의 최소 목표)
// 1단계: 이모지 같은 그림으로 표정의 특징을 익혀요. 2단계: 실제 같은 사진으로 어려운 문제를 풀어요.
const NAMES = { smile: '미소', anger: '화남', surprise: '놀람' }
// 긍정은 초록, 부정은 빨강으로 알려 줘요. 놀람은 어느 쪽으로도 나누지 않아요.
const VALENCE = { smile: ['good', '🟢 긍정 😊'], anger: ['bad', '🔴 부정 😠'] }
const VALENCE_CHOICES = [
  { key: 'good', label: '🟢 긍정 😊' },
  { key: 'bad', label: '🔴 부정 😠' },
]

function makeQuestions(level) {
  const all = []
  if (level === 2) for (const p of PHOTO_LIST) all.push({ type: p.type, variant: 0, src: p.src }) // 모든 사진
  else {
    // 기초는 긍정·부정이 분명한 미소·화남만, 1단계는 놀람까지 모두 나와요.
    const types = level === 0 ? ['smile', 'anger'] : FACE_TYPES
    for (const type of types) for (let variant = 0; variant < FACE_VARIANTS; variant++) all.push({ type, variant })
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, 6)
}

// 결과를 별로 보여 줘요. 글자를 읽기 어려운 분도 알 수 있게 숫자는 작게 곁들여요.
export function Stars({ correct, total }) {
  return (
    <div className="quiz-result">
      <p className="quiz-stars" aria-label={total + '문제 중 ' + correct + '개 맞혔어요'}>
        {'⭐'.repeat(correct)}
        <span className="star-empty">{'☆'.repeat(Math.max(0, total - correct))}</span>
      </p>
      <p className="quiz-count">{correct} / {total}</p>
    </div>
  )
}

const STAGE = { 0: '기초', 1: '1단계', 2: '2단계' }
const NOTE = {
  0: '😊 긍정인지 😠 부정인지 고르는 연습이에요.',
  1: '표정 이름 익히기 연습이에요.',
  2: '실제 사진으로 표정 이름을 익히는 연습이에요.',
}

export default function Quiz({ level = 1, onExit }) {
  const [questions, setQuestions] = useState(() => makeQuestions(level))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [correct, setCorrect] = useState(0)

  const finished = index >= questions.length
  const q = questions[index]
  // 기초는 긍정/부정(good/bad)이, 1·2단계는 표정 이름이 정답이에요.
  const answer = level === 0 ? VALENCE[q?.type]?.[0] : q?.type

  const choose = (key) => {
    if (picked) return
    setPicked(key)
    if (key === answer) setCorrect((c) => c + 1)
  }
  const next = () => {
    setPicked(null)
    setIndex((i) => i + 1)
  }
  const restart = () => {
    setQuestions(makeQuestions(level))
    setIndex(0)
    setPicked(null)
    setCorrect(0)
  }

  const choices = level === 0
    ? VALENCE_CHOICES
    : FACE_TYPES.map((type) => ({ key: type, label: NAMES[type] }))

  return (
    <section className="quiz">
      {!finished ? (
        <>
          <p className="notice">{STAGE[level]} · {index + 1} / {questions.length}</p>
          <div className="quiz-emoji">
            {level === 2
              ? <QuizFace type={q.type} src={q.src} size={200} />
              : <Face type={q.type} variant={q.variant} size={200} />}
          </div>
          <div className="quiz-choices">
            {choices.map(({ key, label }) => {
              let cls = ''
              if (picked) {
                if (key === answer) cls = 'right'
                else if (key === picked) cls = 'wrong'
              }
              return (
                <button key={key} className={cls} onClick={() => choose(key)} disabled={!!picked}>
                  {label}
                </button>
              )
            })}
          </div>
          {picked && (
            <div>
              <p className="quiz-mark">{picked === answer ? '⭕' : '❌'}</p>
              {VALENCE[q.type] && <p className={'valence ' + VALENCE[q.type][0]}>{VALENCE[q.type][1]}</p>}
              <button onClick={next}>{index + 1 === questions.length ? '결과' : '다음 ▶'}</button>
            </div>
          )}
        </>
      ) : (
        <div>
          <Stars correct={correct} total={questions.length} />
          <button onClick={restart}>다시 ↻</button>
        </div>
      )}
      <p className="disclaimer">{NOTE[level]} 점수는 평가가 아니며 저장되지 않아요.</p>
      <p><button className="ghost" onClick={onExit}>←</button></p>
    </section>
  )
}
