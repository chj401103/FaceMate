import { useState } from 'react'

// 보호자 설정: 보호자만 아는 숫자 4자리로 잠겨 있고, 이용자가 좋아하는 것(숫자 세기·말 반복)을 미리 정해 둬요.
// 정해 둔 것은 '쉬어가기'의 '좋아하는 것' 탭에서 보여 줘요.
// 모든 내용은 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않아요.
// 이 잠금은 이용자가 실수로 설정을 바꾸지 않게 막는 용도예요. 강한 보안 장치는 아니에요.
const PIN_KEY = 'facemate.guardian.pin'
const FAV_KEY = 'facemate.guardian.fav'

const read = (key) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장이 막혀 있어도 앱은 그대로 동작해요 */
  }
}

// fav: { type: 'count', max: 5|10|20 } | { type: 'word', text: '...' } | null
export const loadFavorite = () => read(FAV_KEY)

async function hashPin(pin) {
  const data = new TextEncoder().encode(`facemate:${pin}`)
  try {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `plain:${pin}` // 해시를 쓸 수 없는 환경에서도 잠금은 동작해요
  }
}

const COUNT_CHOICES = [5, 10, 20]

export function GuardianModal({ onClose }) {
  const [hasPin, setHasPin] = useState(() => !!read(PIN_KEY))
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [fav, setFav] = useState(loadFavorite)
  const [word, setWord] = useState(() => (loadFavorite()?.type === 'word' ? loadFavorite().text : ''))
  const [saved, setSaved] = useState(false)

  const digitsOnly = (s) => s.replace(/\D/g, '').slice(0, 4)

  const create = async () => {
    if (pin.length !== 4) return setError('숫자 4자리를 입력해 주세요.')
    if (pin !== pin2) return setError('두 번 입력한 숫자가 달라요.')
    write(PIN_KEY, await hashPin(pin))
    setHasPin(true)
    setUnlocked(true)
    setPin('')
    setPin2('')
    setError('')
  }

  const unlock = async () => {
    if ((await hashPin(pin)) === read(PIN_KEY)) {
      setUnlocked(true)
      setPin('')
      setError('')
    } else {
      setError('숫자가 맞지 않아요. 보호자에게 물어봐 주세요.')
      setPin('')
    }
  }

  const choose = (next) => {
    setFav(next)
    setSaved(false)
  }
  const save = () => {
    const value = fav?.type === 'word' ? { type: 'word', text: word.trim() } : fav
    if (value?.type === 'word' && !value.text) return setError('반복할 말을 입력해 주세요.')
    write(FAV_KEY, value)
    setError('')
    setSaved(true)
  }

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-label="보호자 설정">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heart">🔒</div>

        {!unlocked ? (
          <>
            <p className="modal-name">보호자 설정</p>
            <p className="disclaimer">보호자만 열 수 있어요.</p>
            <input
              className="modal-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              placeholder={hasPin ? '숫자 4자리' : '새 숫자 4자리 만들기'}
              onChange={(e) => setPin(digitsOnly(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && (hasPin ? unlock() : pin2 ? create() : null)}
              autoFocus
            />
            {!hasPin && (
              <input
                className="modal-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin2}
                placeholder="한 번 더 입력"
                onChange={(e) => setPin2(digitsOnly(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            )}
            {error && <p className="error">{error}</p>}
            <button onClick={hasPin ? unlock : create}>{hasPin ? '열기' : '만들기'}</button>
            {!hasPin && <p className="disclaimer">이 숫자는 잊지 않게 적어 두세요. 이 기기에만 저장돼요.</p>}
          </>
        ) : (
          <>
            <p className="modal-name">좋아하는 것 정하기</p>
            <p className="disclaimer">
              정해 두면 '쉬어가기'의 '좋아하는 것'에서 차분하게 보여 줘요.
            </p>

            <div className="guardian-choices">
              <button className={fav?.type === 'count' ? '' : 'ghost'} onClick={() => choose({ type: 'count', max: 10 })}>
                🔢 숫자 세기
              </button>{' '}
              <button className={fav?.type === 'word' ? '' : 'ghost'} onClick={() => choose({ type: 'word', text: word })}>
                💬 말 반복
              </button>{' '}
              <button className={!fav ? '' : 'ghost'} onClick={() => choose(null)}>
                없음
              </button>
            </div>

            {fav?.type === 'count' && (
              <p>
                1부터{' '}
                {COUNT_CHOICES.map((n) => (
                  <button key={n} className={fav.max === n ? '' : 'ghost'} onClick={() => choose({ type: 'count', max: n })}>
                    {n}
                  </button>
                ))}{' '}
                까지 반복해요.
              </p>
            )}
            {fav?.type === 'word' && (
              <input
                className="modal-input"
                value={word}
                maxLength={12}
                placeholder="예: 파랑, 기차"
                onChange={(e) => {
                  setWord(e.target.value)
                  setSaved(false)
                }}
              />
            )}

            {error && <p className="error">{error}</p>}
            <button onClick={save}>저장</button>
            {saved && <p className="notice">저장했어요.</p>}
          </>
        )}

        <p><button className="ghost" onClick={onClose}>닫기 ✕</button></p>
      </div>
    </div>
  )
}
