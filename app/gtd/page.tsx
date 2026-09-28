'use client';

import { useMemo, useState } from 'react';

type Item = {
  id: number;
  title: string;
  source: 'Trello' | 'Outlook' | 'Research';
  tag: string;
  status: 'Inbox' | 'Next Action' | 'Waiting';
};

const initialItems: Item[] = [
  { id: 1, title: 'Website-Relaunch prüfen', source: 'Trello', tag: 'Projekt', status: 'Next Action' },
  { id: 2, title: 'Kundenfeedback beantworten', source: 'Outlook', tag: '2-Minuten', status: 'Inbox' },
  { id: 3, title: 'KI-Tools für GTD recherchieren', source: 'Research', tag: 'Recherche', status: 'Next Action' },
  { id: 4, title: 'Angebot von Agentur abwarten', source: 'Outlook', tag: 'Delegiert', status: 'Waiting' },
];

const sourceColors: Record<Item['source'], string> = {
  Trello: '#2563eb',
  Outlook: '#0ea5e9',
  Research: '#7c3aed',
};

export default function GTDCommandCenter() {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [research, setResearch] = useState('');
  const [researchRunning, setResearchRunning] = useState(false);
  const [connected, setConnected] = useState({ trello: false, outlook: false });

  const filtered = useMemo(
    () => items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );

  function addInbox() {
    const title = window.prompt('Was möchtest du erfassen?');
    if (!title?.trim()) return;
    setItems((current) => [
      { id: Date.now(), title: title.trim(), source: 'Outlook', tag: 'Neu', status: 'Inbox' },
      ...current,
    ]);
  }

  function clarify(id: number) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status: 'Next Action' } : item))
    );
  }

  function startResearch() {
    if (!research.trim()) return;
    setResearchRunning(true);
    window.setTimeout(() => {
      setResearchRunning(false);
      setItems((current) => [
        {
          id: Date.now(),
          title: research.trim(),
          source: 'Research',
          tag: 'Recherche',
          status: 'Next Action',
        },
        ...current,
      ]);
      setResearch('');
    }, 900);
  }

  const counts = {
    inbox: items.filter((i) => i.status === 'Inbox').length,
    next: items.filter((i) => i.status === 'Next Action').length,
    waiting: items.filter((i) => i.status === 'Waiting').length,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f6f7f9', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 56px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#64748b', textTransform: 'uppercase' }}>GTD Command Center</div>
            <h1 style={{ margin: '7px 0 0', fontSize: 32, letterSpacing: -1.2 }}>Alles an einem Ort.</h1>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>Trello, Outlook und Deep Research in einem klaren GTD-Workflow.</p>
          </div>
          <button onClick={addInbox} style={primary}>+ Eingang erfassen</button>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            ['Inbox', counts.inbox, '#fff7ed'],
            ['Nächste Aktionen', counts.next, '#eff6ff'],
            ['Warten auf', counts.waiting, '#f5f3ff'],
          ].map(([label, value, bg]) => (
            <div key={String(label)} style={{ ...card, background: String(bg) }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 5 }}>{value}</div>
            </div>
          ))}
        </section>

        <section style={{ ...card, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div>
              <h2 style={h2}>Integrationen</h2>
              <p style={muted}>Verbinde deine Arbeitsquellen für einen gemeinsamen Eingang.</p>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setConnected((c) => ({ ...c, trello: !c.trello }))} style={connect(connected.trello, '#2563eb')}>Trello · {connected.trello ? 'verbunden' : 'verbinden'}</button>
              <button onClick={() => setConnected((c) => ({ ...c, outlook: !c.outlook }))} style={connect(connected.outlook, '#0ea5e9')}>Outlook · {connected.outlook ? 'verbunden' : 'verbinden'}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={integration}><b>Trello</b><span>Boards → Karten → Projekte & nächste Aktionen</span></div>
            <div style={integration}><b>Outlook Email</b><span>Posteingang → Aufgaben, Warten auf & Referenz</span></div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div><h2 style={h2}>GTD Eingang & nächste Aktionen</h2><p style={muted}>Klären, organisieren, erledigen.</p></div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen…" style={input} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {filtered.map((item) => (
                <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: sourceColors[item.source], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{item.source} · {item.tag}</div>
                  </div>
                  <span style={pill(item.status)}>{item.status}</span>
                  {item.status === 'Inbox' && <button onClick={() => clarify(item.id)} style={smallButton}>Klären</button>}
                </div>
              ))}
              {!filtered.length && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Keine Treffer.</div>}
            </div>
          </div>

          <aside style={card}>
            <h2 style={h2}>Deep Research</h2>
            <p style={muted}>Starte eine Recherche und überführe das Ergebnis anschließend in dein GTD-System.</p>
            <textarea value={research} onChange={(e) => setResearch(e.target.value)} placeholder="z. B. 'Vergleiche aktuelle Projektmanagement-Tools für unser Team'" style={{ ...input, minHeight: 110, resize: 'vertical' }} />
            <button onClick={startResearch} disabled={researchRunning} style={{ ...primary, width: '100%', marginTop: 10, opacity: researchRunning ? .65 : 1 }}>
              {researchRunning ? 'Recherche wird vorbereitet…' : 'Recherche starten'}
            </button>
            <div style={{ marginTop: 18, padding: 13, borderRadius: 12, background: '#faf5ff', color: '#6d28d9', fontSize: 13 }}>
              Die App ist so aufgebaut, dass der Research-Schritt später an die Deep-Research-Schnittstelle angebunden werden kann.
            </div>
          </aside>
        </section>

        <footer style={{ marginTop: 24, color: '#94a3b8', fontSize: 12 }}>
          Workflow: Capture → Clarify → Organize → Reflect → Engage
        </footer>
      </div>
    </main>
  );
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,.03)' } as const;
const h2 = { margin: 0, fontSize: 17, letterSpacing: -.3 } as const;
const muted = { margin: '5px 0 0', color: '#64748b', fontSize: 13 } as const;
const input = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #dbe1e8', borderRadius: 10, padding: '10px 12px', font: 'inherit', outline: 'none', background: '#fff' };
const primary = { border: 0, borderRadius: 10, background: '#111827', color: '#fff', padding: '11px 15px', fontWeight: 750, cursor: 'pointer' };
const smallButton = { border: '1px solid #dbe1e8', background: '#fff', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', fontWeight: 650 };
const integration = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 5 };
const connect = (active: boolean, color: string) => ({ border: `1px solid ${active ? color : '#dbe1e8'}`, background: active ? `${color}12` : '#fff', color: active ? color : '#475569', borderRadius: 9, padding: '8px 11px', fontWeight: 700, cursor: 'pointer' });
const pill = (status: Item['status']) => ({ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: '5px 8px', background: status === 'Inbox' ? '#fff7ed' : status === 'Waiting' ? '#f5f3ff' : '#eff6ff', color: status === 'Inbox' ? '#c2410c' : status === 'Waiting' ? '#6d28d9' : '#1d4ed8' });
