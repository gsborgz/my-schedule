import { listActivities, type Activity } from './activities.js';
import { config } from './config.js';
import { db, setMeta } from './db.js';
import { sendToAll } from './push.js';
import { occursOn } from './recurrence.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Quantos minutos para trás procurar lembretes pendentes. Cobre atrasos ou
 * execuções puladas do agendador externo; o notification_log impede duplicatas.
 */
const LOOKBACK_MINUTES = 5;

/** Data/hora de um instante no fuso configurado (independente do fuso do servidor). */
function inTimeZone(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    date,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    minutes,
    key: `${date}T${String(minutes).padStart(4, '0')}`,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function reminderBody(a: Activity): string {
  const range = a.endTime ? `${a.startTime}–${a.endTime}` : a.startTime;
  const when = a.remindBefore === 0 ? 'Começa agora' : `Começa em ${a.remindBefore} min`;
  return [`${when} (${range})`, a.notes].filter(Boolean).join('\n');
}

/** Envia os lembretes devidos agora. Pode ser chamada quantas vezes quiser. */
export async function runReminders(now = new Date()): Promise<{ sent: string[] }> {
  // Instantes dos últimos minutos, do mais antigo ao atual.
  const recent = Array.from({ length: LOOKBACK_MINUTES + 1 }, (_, i) => now.getTime() - (LOOKBACK_MINUTES - i) * 60_000);
  const sent: string[] = [];

  for (const a of await listActivities()) {
    if (!a.enabled || a.remindBefore === null) continue;
    const lead = a.remindBefore * 60_000;
    const start = toMinutes(a.startTime);

    // Para cada minuto recente, a ocorrência lembrada naquele minuto começaria
    // `remindBefore` minutos depois. Calcular pela data dessa ocorrência faz um
    // lembrete de 00:05 (10 min antes) disparar às 23:55 do dia anterior.
    const dueAt = recent.find((t) => {
      const occurrence = inTimeZone(t + lead, config.timeZone);
      return occurrence.minutes === start && occursOn(a, occurrence.date, occurrence.weekday);
    });
    if (dueAt === undefined) continue;

    const claim = await db.execute({
      sql: 'INSERT OR IGNORE INTO notification_log (activity_id, fire_key) VALUES (?, ?)',
      args: [a.id, inTimeZone(dueAt, config.timeZone).key],
    });
    if (claim.rowsAffected === 0) continue; // já enviado

    const { delivered, failures } = await sendToAll({ title: a.title, body: reminderBody(a), url: '/#/agenda', tag: `activity-${a.id}` });
    console.log(`[reminders] "${a.title}" → ${delivered} enviado(s), ${failures.length} falha(s)`);
    sent.push(a.title);
  }

  await setMeta('last_cron_run', now.toISOString());

  // Limpeza ocasional do histórico.
  if (inTimeZone(now.getTime(), config.timeZone).minutes === 0) {
    await db.execute("DELETE FROM notification_log WHERE fire_key < date('now', '-7 days')");
  }

  return { sent };
}
