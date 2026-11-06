import { useState } from 'react'
import readme from '../README.md?raw' // README 내용을 그대로 가져와요. README를 고치면 여기도 함께 바뀌어요.

// 설명: README의 내용을 섹션별 제목으로 보여 주고, ▶ 를 누르면 아래로 펼쳐져요.
// body: 문자열은 문단, 배열은 목록이에요. **굵게** 표시를 쓸 수 있어요.
const SECTIONS = [
  {
    title: '📷 내 얼굴로 표정 학습',
    body: [
      [
        '시작하기 전에 😐 편안한 표정을 먼저 짓고, 카메라로 **내 얼굴**의 기본 표정을 측정합니다.',
        '기본 표정 대비 얼마나 움직였는지를 **게이지**로 보여 줍니다. 남과 비교하지 않고 **나의 변화**만 봅니다.',
        '어디를 더 움직이면 좋을지 힌트를 줍니다.',
        '표정을 지으려면 얼굴 근육을 직접 움직여야 하므로, 얼굴 근육을 쓰는 연습이 되도록 했습니다.',
      ],
    ],
  },
  {
    title: '🎨 이모지 설명',
    body: [
      [
        '게이지마다 **큰 그림**이 붙어 있습니다. 👄 입, 👁️ 눈, 🤨 눈썹, 😠 미간',
        '**긍정(미소)은 🟢 초록색, 부정(화남)은 🔴 빨간색**으로 게이지와 카메라 테두리가 표시됩니다. 깜빡이거나 움직이지 않습니다.',
        '연습을 마치면 **🟢 긍정 표정 😊 / 🔴 부정 표정 😠** 이라고 알려 줍니다.',
      ],
    ],
  },
  {
    title: '🧘 집중을 돕는 차분한 화면',
    body: [
      [
        '배경을 그림이나 무늬로 화려하게 꾸밀 수도 있었지만, **자폐 이용자가 집중이 흐려지거나 불안해할 수 있어 최소한으로만 했습니다.**',
        '무늬 없이 **어둡고 잔잔한 배경**(은은한 빛 번짐만)을 쓰고, 소리·깜빡임·갑작스러운 움직임을 넣지 않았습니다.',
        '게이지와 카메라 테두리도 움직이거나 깜빡이지 않고 **색의 진하기만** 바뀝니다.',
      ],
    ],
  },
  {
    title: '👀 단계별 표정 퀴즈',
    body: [
      [
        '**기초 🟢🔴** 표정 그림을 보고 긍정 😊 / 부정 😠 중 고르기 → 최소한 긍정·부정은 구분하기',
        '**1단계 😊** 이모지 같은 그림 보고 표정 맞추기 → 표정의 특징을 직관적으로 익히기',
        '**2단계 🖼️** 실제 같은 사진 보고 표정 맞추기 → 실전·고난도 문제로 응용하기',
        '**직접 지어 맞추기 📷** 글자보다 이모지(😊😠😮) 위주로 보여 주는 제시어를 보고, 내 표정으로 따라 하기',
        '정답을 맞히면 ⭕와 함께 그 표정이 🟢 긍정인지 🔴 부정인지 알려 줍니다.',
        '퀴즈가 끝나면 결과를 **⭐ 별 개수**로 보여 줍니다. 글자를 읽기 어려운 분도 알 수 있고, 숫자는 작게 곁들입니다.',
        '게임 같은 형식이라 부담 없이 반복할 수 있습니다.',
      ],
    ],
  },
  {
    title: '⏸️ 쉬어가기',
    body: [
      [
        '몰입하다 흥분하는 경우를 위해, **소리·깜빡임·점수·시간 제한이 없는** 화면입니다.',
        '**오른쪽 위에 항상 떠 있는 "안정" 버튼**을 누르면 어느 화면에서든 바로 들어갈 수 있습니다.',
        '카메라를 **5분 넘게 켜 두면 "🌿 오래 했어요. 잠깐 쉬어갈까요?"** 하고 부드럽게 권합니다. 소리나 깜빡임 없이 작은 안내만 나오고, 원하지 않으면 "계속하기"를 누르면 됩니다.',
        '🔢 좋아하는 것: 보호자가 미리 정해 둔 활동(예: 숫자 세기)을 보여 줍니다.',
        '🌬️ 숨쉬기: 들이쉬기 4초, 내쉬기 6초가 숫자와 함께 반복됩니다.',
        '👀 지금 여기 찾기: 보이는 것, 들리는 것, 만져지는 것을 차례로 찾습니다.',
      ],
    ],
  },
  {
    title: '🔒 보호자 설정',
    body: [
      '이용자마다 마음이 안정되는 방법이 다르기 때문에, 보호자가 좋아하는 것(숫자 세기·말 반복)을 미리 정해 둡니다. 홈의 \'개인정보\' 아이콘에서 열 수 있고, 보호자만 아는 숫자 4자리로 잠겨 있어 이용자가 실수로 바꾸지 않습니다.',
    ],
  },
  {
    title: '❤️ 내 기록',
    body: ['별명으로 로그인하면 날짜와 달성도가 쌓여 변화를 확인할 수 있습니다.'],
  },
  {
    title: '💬 의견 보내기',
    body: ['홈 화면 맨 아래의 "의견 보내기"에서 **추가했으면 하는 기능이나 불편한 점**을 남길 수 있습니다.'],
  },
]

// 아주 작은 마크다운 변환기: 제목(#), 목록(-), 표(|), 코드 블록, **굵게**, `코드`, 주소를 README 그대로 보여 줘요.
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/\S+)/g
const FENCE = '```'

function Rich({ text }) {
  return text.split(INLINE_RE).map((p, i) => {
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
    return <span key={i}>{p}</span>
  })
}

const isBlockStart = (l) => /^(#{1,3} |- )/.test(l) || l.startsWith('|') || l.startsWith(FENCE)

function Markdown({ text }) {
  const lines = text.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith(FENCE)) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith(FENCE)) code.push(lines[i++])
      i++
      out.push(<pre key={out.length}>{code.join('\n')}</pre>)
    } else if (/^#{1,3} /.test(line)) {
      const Tag = 'h' + (line.match(/^#+/)[0].length + 2)
      out.push(<Tag key={out.length}><Rich text={line.replace(/^#+ /, '')} /></Tag>)
      i++
    } else if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim())
      const [head, , ...body] = rows
      out.push(
        <div key={out.length} className="md-table">
          <table>
            <thead><tr>{cells(head).map((c, k) => <th key={k}><Rich text={c} /></th>)}</tr></thead>
            <tbody>
              {body.map((r, k) => <tr key={k}>{cells(r).map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      )
    } else if (line.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2))
      out.push(<ul key={out.length}>{items.map((t, k) => <li key={k}><Rich text={t} /></li>)}</ul>)
    } else if (line.trim() === '') {
      i++
    } else {
      const para = []
      while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) para.push(lines[i++])
      out.push(
        <p key={out.length}>
          {para.map((t, k) => <span key={k}>{k > 0 && <br />}<Rich text={t} /></span>)}
        </p>,
      )
    }
  }
  return <>{out}</>
}

// **굵게** 표시를 <b>로 바꿔요.
function Inline({ text }) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
}

// README를 '## 제목' 단위로 나눠, 제목만 보이고 ▶ 를 누르면 펼쳐지게 해요.
function ReadmeSections({ text }) {
  const [open, setOpen] = useState(null)
  const intro = []
  const chunks = []
  let cur = null
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      cur = { title: line.slice(3), lines: [] }
      chunks.push(cur)
    } else if (cur) cur.lines.push(line)
    else intro.push(line)
  }
  return (
    <>
      <Markdown text={intro.join('\n')} />
      <div className="help-acc help-sub">
        {chunks.map((c, i) => {
          const isOpen = open === i
          return (
            <div key={c.title} className={isOpen ? 'help-item open' : 'help-item'}>
              <button className="help-head" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                <span><Rich text={c.title} /></span>
                <span className="help-arrow" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
              </button>
              {isOpen && <div className="help-body md"><Markdown text={c.lines.join('\n')} /></div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function HelpModal({ onClose }) {
  const [open, setOpen] = useState(null) // 한 번에 하나만 펼쳐요

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-label="설명">
      <div className="modal-card help-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heart">❓</div>
        <p className="modal-name">설명</p>
        <p className="disclaimer">궁금한 제목의 ▶ 를 눌러 보세요. 맨 아래 제작 이유에서 전체 설명을 볼 수 있어요.</p>

        <div className="help-acc">
          {SECTIONS.map((s, i) => {
            const isOpen = open === i
            return (
              <div key={s.title} className={isOpen ? 'help-item open' : 'help-item'}>
                <button className="help-head" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  <span>{s.title}</span>
                  <span className="help-arrow" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                </button>
                {isOpen && (
                  <div className="help-body">
                    {s.body.map((b, k) =>
                      Array.isArray(b) ? (
                        <ul key={k}>
                          {b.map((li) => <li key={li}><Inline text={li} /></li>)}
                        </ul>
                      ) : (
                        <p key={k}><Inline text={b} /></p>
                      ),
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <div className={open === 'readme' ? 'help-item open' : 'help-item'}>
            <button className="help-head" onClick={() => setOpen(open === 'readme' ? null : 'readme')} aria-expanded={open === 'readme'}>
              <span>💡 제작 이유</span>
              <span className="help-arrow" aria-hidden="true">{open === 'readme' ? '▼' : '▶'}</span>
            </button>
            {open === 'readme' && <div className="help-body md"><ReadmeSections text={readme} /></div>}
          </div>
        </div>

        <p><button className="ghost" onClick={onClose}>닫기 ✕</button></p>
      </div>
    </div>
  )
}
