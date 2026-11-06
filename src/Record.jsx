import { useState } from 'react'
import Face from './Faces.jsx'

// 학습 기록: 이름(별명)만 입력하는 간단한 로그인이에요.
// 기록(날짜·표정·달성도)은 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않아요.
// 카메라 영상과 얼굴 좌표는 저장하지 않아요.
const PROFILE_KEY = 'facemate.profile'
const RECORDS_KEY = 'facemate.records'

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장이 막혀 있어도 앱은 그대로 동작해요 */
  }
}

export const loadProfile = () => read(PROFILE_KEY, null)

// 로그인한 경우에만 기록해요. rec: { expr, score(0~1), kind }
export function addRecord(rec) {
  const profile = loadProfile()
  if (!profile) return
  const all = read(RECORDS_KEY, [])
  all.push({ name: profile.name, t: Date.now(), ...rec })
  write(RECORDS_KEY, all.slice(-200))
}

const fmt = (t) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function RecordModal({ onClose }) {
  const [profile, setProfile] = useState(loadProfile)
  const [name, setName] = useState('')
  const [records, setRecords] = useState(() => read(RECORDS_KEY, []))

  const login = () => {
    const n = name.trim()
    if (!n) return
    write(PROFILE_KEY, { name: n })
    setProfile({ name: n })
    setName('')
  }
  const logout = () => {
    try {
      localStorage.removeItem(PROFILE_KEY)
    } catch {
      /* 무시 */
    }
    setProfile(null)
  }
  const clear = () => {
    const rest = records.filter((r) => r.name !== profile.name)
    write(RECORDS_KEY, rest)
    setRecords(rest)
  }

  const all = profile ? records.filter((r) => r.name === profile.name) : []
  const mine = all.slice(-12).reverse()

  // 요약: 전체 학습률(모든 기록의 평균)과 가장 잘 학습한 표정(표정별 평균이 가장 높은 것)
  const NAMES = { smile: '미소', anger: '화남', surprise: '놀람' }
  const avg = (list) => list.reduce((s, r) => s + r.score, 0) / list.length
  const overall = all.length ? Math.round(avg(all) * 100) : 0
  let best = null
  for (const type of Object.keys(NAMES)) {
    const list = all.filter((r) => r.expr === type)
    if (list.length && (!best || avg(list) > best.value)) best = { type, value: avg(list) }
  }

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-label="학습 기록">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heart">❤️</div>
        {!profile ? (
          <>
            <input
              className="modal-input"
              value={name}
              maxLength={12}
              placeholder="이름 (별명)"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              autoFocus
            />
            <button onClick={login}>로그인</button>
            <p className="disclaimer">비밀번호는 없어요. 기록은 이 기기에만 저장돼요.</p>
          </>
        ) : (
          <>
            <p className="modal-name">{profile.name}</p>
            {mine.length === 0 ? (
              <p className="disclaimer">아직 기록이 없어요. 연습을 끝내면 여기에 쌓여요.</p>
            ) : (
              <>
              <div className="record-summary">
                <div className="record-stat">
                  <span className="record-stat-label">전체 학습률</span>
                  <span className="record-stat-value">{overall}%</span>
                </div>
                <div className="record-stat">
                  <span className="record-stat-label">가장 잘한 표정</span>
                  <span className="record-stat-value">
                    {best && <Face type={best.type} variant={0} size={44} />}
                    {best && NAMES[best.type]} {best && `${Math.round(best.value * 100)}%`}
                  </span>
                </div>
              </div>
              <ul className="record-list">
                {mine.map((r) => (
                  <li key={r.t}>
                    <Face type={r.expr} variant={0} size={36} />
                    <span className="record-bar"><span style={{ width: `${Math.round(r.score * 100)}%` }} /></span>
                    <span className="record-pct">{Math.round(r.score * 100)}%</span>
                    <span className="record-date">{fmt(r.t)}</span>
                  </li>
                ))}
              </ul>
              </>
            )}
            <p>
              <button className="ghost" onClick={clear}>기록 지우기</button>{' '}
              <button className="ghost" onClick={logout}>로그아웃</button>
            </p>
          </>
        )}
        <p><button className="ghost" onClick={onClose}>닫기 ✕</button></p>
      </div>
    </div>
  )
}
