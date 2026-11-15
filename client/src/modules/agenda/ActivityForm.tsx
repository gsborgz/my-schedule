import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { DAY_SHORT, WEEK_ORDER } from '../../lib/days';
import type { Activity, ActivityInput } from '../../types';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
const REMINDERS: { label: string; value: number | null }[] = [
  { label: 'Sem lembrete', value: null },
  { label: 'Na hora', value: 0 },
  { label: '5 min antes', value: 5 },
  { label: '10 min antes', value: 10 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 hora antes', value: 60 },
];

interface Props {
  activity: Activity | null;
  defaultDay: number;
  onClose: () => void;
  onSaved: (a: Activity) => void;
  onDeleted: (id: number) => void;
}

export function ActivityForm({ activity, defaultDay, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<ActivityInput>(
    activity ?? {
      title: '',
      notes: '',
      days: [defaultDay],
      startTime: '08:00',
      endTime: null,
      remindBefore: 10,
      color: COLORS[0],
      enabled: true,
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (d: number) =>
    set('days', form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = activity ? await api.activities.update(activity.id, form) : await api.activities.create(form);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!activity || !confirm(`Excluir "${activity.title}"?`)) return;
    setSaving(true);
    try {
      await api.activities.remove(activity.id);
      onDeleted(activity.id);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={activity ? 'Editar atividade' : 'Nova atividade'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Título
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Academia" autoFocus required />
        </label>

        <fieldset>
          <legend>Dias da semana</legend>
          <div className="day-picker">
            {WEEK_ORDER.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip ${form.days.includes(d) ? 'on' : ''}`}
                aria-pressed={form.days.includes(d)}
                onClick={() => toggleDay(d)}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
          <div className="row gap small">
            <button type="button" className="link" onClick={() => set('days', [1, 2, 3, 4, 5])}>
              Seg a Sex
            </button>
            <button type="button" className="link" onClick={() => set('days', [0, 6])}>
              Fim de semana
            </button>
            <button type="button" className="link" onClick={() => set('days', [0, 1, 2, 3, 4, 5, 6])}>
              Todos
            </button>
          </div>
        </fieldset>

        <div className="row gap">
          <label className="grow">
            <span>Início</span>
            <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </label>
          <label className="grow">
            <span>
              Término <span className="muted small">(opcional)</span>
            </span>
            <input type="time" value={form.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} />
          </label>
        </div>

        <label>
          Lembrete
          <select
            value={form.remindBefore === null ? '' : String(form.remindBefore)}
            onChange={(e) => set('remindBefore', e.target.value === '' ? null : Number(e.target.value))}
          >
            {REMINDERS.map((r) => (
              <option key={r.label} value={r.value === null ? '' : r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Observações
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Opcional" />
        </label>

        <fieldset>
          <legend>Cor</legend>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch ${form.color === c ? 'on' : ''}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
                onClick={() => set('color', c)}
              />
            ))}
          </div>
        </fieldset>

        <label className="checkbox">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Atividade ativa
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          {activity && (
            <button type="button" className="btn danger" onClick={remove} disabled={saving}>
              Excluir
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
