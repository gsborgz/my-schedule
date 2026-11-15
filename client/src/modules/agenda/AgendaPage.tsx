import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../../lib/api';
import { DAY_LONG, DAY_SHORT, WEEK_ORDER, nowMinutes, toMinutes } from '../../lib/days';
import type { Activity } from '../../types';
import { ActivityForm } from './ActivityForm';

type Editing = { activity: Activity | null; day: number } | null;

export function AgendaPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [editing, setEditing] = useState<Editing>(null);
  const [now, setNow] = useState(nowMinutes);
  const today = new Date().getDay();

  useEffect(() => {
    api.activities
      .list()
      .then(setActivities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    const timer = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<number, Activity[]>(WEEK_ORDER.map((d) => [d, []]));
    for (const a of activities) for (const d of a.days) map.get(d)!.push(a);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [activities]);

  function handleSaved(saved: Activity) {
    setActivities((list) => {
      const exists = list.some((a) => a.id === saved.id);
      return exists ? list.map((a) => (a.id === saved.id ? saved : a)) : [...list, saved];
    });
    setEditing(null);
  }

  function handleDeleted(id: number) {
    setActivities((list) => list.filter((a) => a.id !== id));
    setEditing(null);
  }

  if (loading) return <p className="muted">Carregando agenda…</p>;

  return (
    <section className="agenda">
      <div className="agenda-header">
        <div>
          <h1>Agenda</h1>
          <p className="muted">{DAY_LONG[selectedDay]}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({ activity: null, day: selectedDay })}>
          + Nova atividade
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="day-tabs" role="tablist">
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === selectedDay}
            className={`day-tab ${d === selectedDay ? 'active' : ''} ${d === today ? 'today' : ''}`}
            onClick={() => setSelectedDay(d)}
          >
            <span>{DAY_SHORT[d]}</span>
            <small>{byDay.get(d)!.length || ''}</small>
          </button>
        ))}
      </div>

      <div className="week">
        {WEEK_ORDER.map((d) => (
          <div key={d} className={`day-column ${d === selectedDay ? 'selected' : ''} ${d === today ? 'today' : ''}`}>
            <button className="day-column-title" onClick={() => setSelectedDay(d)}>
              {DAY_LONG[d]}
            </button>
            {byDay.get(d)!.length === 0 ? (
              <button className="empty-day" onClick={() => setEditing({ activity: null, day: d })}>
                Nada por aqui. Adicionar?
              </button>
            ) : (
              byDay.get(d)!.map((a) => {
                const start = toMinutes(a.startTime);
                const end = a.endTime ? toMinutes(a.endTime) : start + 1;
                const isNow = d === today && now >= start && now < end;
                const isPast = d === today && now >= end;
                return (
                  <button
                    key={a.id}
                    className={`activity ${isNow ? 'now' : ''} ${isPast ? 'past' : ''} ${a.enabled ? '' : 'disabled'}`}
                    style={{ '--accent': a.color } as CSSProperties}
                    onClick={() => setEditing({ activity: a, day: d })}
                  >
                    <span className="activity-time">
                      {a.startTime}
                      {a.endTime && <> – {a.endTime}</>}
                    </span>
                    <span className="activity-title">{a.title}</span>
                    {a.notes && <span className="activity-notes">{a.notes}</span>}
                    <span className="activity-meta">
                      {isNow && <span className="badge">agora</span>}
                      {a.remindBefore !== null && a.enabled && (
                        <span title="Lembrete">🔔 {a.remindBefore === 0 ? 'na hora' : `${a.remindBefore} min antes`}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>

      <button className="fab" aria-label="Nova atividade" onClick={() => setEditing({ activity: null, day: selectedDay })}>
        +
      </button>

      {editing && (
        <ActivityForm
          activity={editing.activity}
          defaultDay={editing.day}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  );
}
