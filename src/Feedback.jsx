import { useState } from 'react'

// 의견 보내기: 기능 추가·불편한 점을 적어 보내는 칸이에요.
// 쓴 글(종류·내용)만 서버로 보내요. 카메라 영상·얼굴 정보·기록은 보내지 않아요.
const TYPES = [
  { key: 'feature', icon: '💡', label: '이런 기능이 있으면 좋겠어요' },
  { key: 'problem', icon: '😣', label: '불편해요' },
  { key: 'other', icon: '💬', label: '그 밖의 의견' },
]
const MAX_LEN = 500

export function FeedbackModal({ onClose }) {
  const [type, setType] = useState('feature')
  const [text, setText] = useState('')
  const [website, setWebsite] = useState('') // 자동 입력 방지용 숨김 칸
  const [state, setState] = useState('idle') // idle | sending | done | error

  const send = async () => {
    if (!text.trim() || state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text, website }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-label="의견 보내기">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heart">💬</div>
        {state === 'done' ? (
          <>
            <p className="modal-name">고맙습니다 🙏</p>
            <p className="disclaimer">보내 주신 의견은 더 좋은 FaceMate를 만드는 데 쓸게요.</p>
          </>
        ) : (
          <>
            <p className="modal-name">의견 보내기</p>
            <div className="feedback-types">
              {TYPES.map((t) => (
                <button key={t.key} className={type === t.key ? '' : 'ghost'} onClick={() => setType(t.key)}>
                  <span aria-hidden="true">{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
            <textarea
              className="modal-input feedback-text"
              value={text}
              maxLength={MAX_LEN}
              rows={5}
              placeholder="여기에 적어 주세요"
              onChange={(e) => setText(e.target.value)}
            />
            <input
              className="feedback-trap"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            {state === 'error' && <p className="error">보내지 못했어요. 잠시 후 다시 눌러 주세요.</p>}
            <button onClick={send} disabled={!text.trim() || state === 'sending'}>
              {state === 'sending' ? '보내는 중…' : '보내기 ✉️'}
            </button>
            <p className="disclaimer">
              쓴 글만 전송돼요. 카메라 영상·얼굴 정보·연습 기록은 보내지 않아요. 이름이나 연락처는 쓰지 않아도 돼요.
            </p>
          </>
        )}
        <p><button className="ghost" onClick={onClose}>닫기 ✕</button></p>
      </div>
    </div>
  )
}
