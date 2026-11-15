import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../../lib/api';
import {
  DAY_LONG,
  DAY_SHORT,
  addDays,
  describeRepeat,
  formatDayMonth,
  nowMinutes,
  occursOn,
  toISODate,
  toMinutes,
  weekStart,
} from '../../lib/days';
import type { Activity } from '../../types';
import { ActivityForm } from './ActivityForm';

type Editing = { activity: Activity | null; date: Date } | null;

export function AgendaPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [editing, setEditing] = useState<Editing>(null);
  const [now, setNow] = useState(nowMinutes);
  const todayISO = toISODate(new Date());

  useEffect(() => {
    api.activities
      .list()
      .then(setActivities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    const timer = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Datas da semana exibida (segunda → domingo).
  const week = useMemo(() => {
    const start = weekStart(new Date(), weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  const byDate = useMemo(
    () =>
      week.map((date) =>
        activities.filter((a) => occursOn(a, date)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
      ),
    [week, activities],
  );

  const selectedIndex = week.findIndex((d) => d.getDay() === selectedDay);
  const selectedDate = week[selectedIndex];

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

  function goToToday() {
    setWeekOffset(0);
    setSelectedDay(new Date().getDay());
  }

  if (loading) return <p className="muted">Carregando agenda…</p>;

  return (
    <section className="agenda">
      <div className="agenda-header">
        <div>
          <h1>Agenda</h1>
          <p className="muted">
            {DAY_LONG[selectedDay]}, {formatDayMonth(selectedDate)}
          </p>
        </div>
        <button className="btn primary new-btn" onClick={() => setEditing({ activity: null, date: selectedDate })}>
          + Nova atividade
        </button>
      </div>

      <div className="week-nav">
        <button className="icon-btn" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
          ‹
        </button>
        <span className="week-range">
          {formatDayMonth(week[0])} – {formatDayMonth(week[6])}
        </span>
        <button className="icon-btn" aria-label="Próxima semana" onClick={() => setWeekOffset((w) => w + 1)}>
          ›
        </button>
        {(weekOffset !== 0 || selectedDay !== new Date().getDay()) && (
          <button className="btn small-btn" onClick={goToToday}>
            Hoje
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="day-tabs" role="tablist">
        {week.map((date, i) => {
          const d = date.getDay();
          return (
            <button
              key={d}
              role="tab"
              aria-selected={d === selectedDay}
              className={`day-tab ${d === selectedDay ? 'active' : ''} ${toISODate(date) === todayISO ? 'today' : ''}`}
              onClick={() => setSelectedDay(d)}
            >
              <span>{DAY_SHORT[d]}</span>
              <strong>{date.getDate()}</strong>
              <i className={`day-dot ${byDate[i].length ? 'on' : ''}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="week">
        {week.map((date, i) => {
          const d = date.getDay();
          const isToday = toISODate(date) === todayISO;
          const isPastDay = toISODate(date) < todayISO;
          return (
            <div key={d} className={`day-column ${d === selectedDay ? 'selected' : ''} ${isToday ? 'today' : ''}`}>
              <button className="day-column-title" onClick={() => setSelectedDay(d)}>
                {DAY_LONG[d]} <span className="muted">{formatDayMonth(date)}</span>
              </button>
              {byDate[i].length === 0 ? (
                <button className="empty-day" onClick={() => setEditing({ activity: null, date })}>
                  Nada por aqui. Adicionar?
                </button>
              ) : (
                byDate[i].map((a) => {
                  const start = toMinutes(a.startTime);
                  const end = a.endTime ? toMinutes(a.endTime) : start + 1;
                  const isNow = isToday && now >= start && now < end;
                  const isPast = isPastDay || (isToday && now >= end);
                  return (
                    <button
                      key={a.id}
                      className={`activity ${isNow ? 'now' : ''} ${isPast ? 'past' : ''} ${a.enabled ? '' : 'disabled'}`}
                      style={{ '--accent': a.color } as CSSProperties}
                      onClick={() => setEditing({ activity: a, date })}
                    >
                      <span className="activity-time">
                        {a.startTime}
                        {a.endTime && <> – {a.endTime}</>}
                      </span>
                      <span className="activity-title">{a.title}</span>
                      {a.notes && <span className="activity-notes">{a.notes}</span>}
                      <span className="activity-meta">
                        {isNow && <span className="badge">agora</span>}
                        <span title="Repetição">🔁 {describeRepeat(a)}</span>
                        {a.remindBefore !== null && a.enabled && (
                          <span title="Lembrete">🔔 {a.remindBefore === 0 ? 'na hora' : `${a.remindBefore} min antes`}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <button className="fab" aria-label="Nova atividade" onClick={() => setEditing({ activity: null, date: selectedDate })}>
        +
      </button>

      {editing && (
        <ActivityForm
          activity={editing.activity}
          defaultDate={editing.date}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  );
}
