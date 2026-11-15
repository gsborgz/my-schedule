import { listActivities, type Activity } from './activities.js';
import { config } from './config.js';
import { db } from './db.js';
import { sendToAll } from './push.js';

const DAY = 1440;
const WEEK = 7 * DAY;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Quantos minutos para trás procurar lembretes pendentes. Cobre atrasos ou
 * execuções puladas do agendador externo; o notification_log impede duplicatas.
 */
const LOOKBACK_MINUTES = 5;

/** Data/hora de um instante no fuso configurado (independente do fuso do servidor). */
function inTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const date_ = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    minuteOfWeek: WEEKDAYS.indexOf(get('weekday')) * DAY + minutes,
    key: `${date_}T${String(minutes).padStart(4, '0')}`,
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
  // Os últimos minutos, do mais antigo ao atual.
  const recent = Array.from({ length: LOOKBACK_MINUTES + 1 }, (_, i) =>
    inTimeZone(new Date(now.getTime() - (LOOKBACK_MINUTES - i) * 60_000), config.timeZone),
  );
  const sent: string[] = [];

  for (const a of await listActivities()) {
    if (!a.enabled || a.remindBefore === null) continue;
    const remindBefore = a.remindBefore;

    // Compara em "minutos da semana" para que um lembrete de 00:05 com 10 min de
    // antecedência dispare corretamente às 23:55 do dia anterior.
    const fireTimes = new Set(a.days.map((d) => (((d * DAY + toMinutes(a.startTime) - remindBefore) % WEEK) + WEEK) % WEEK));
    const due = recent.find((m) => fireTimes.has(m.minuteOfWeek));
    if (!due) continue;

    const claim = await db.execute({
      sql: 'INSERT OR IGNORE INTO notification_log (activity_id, fire_key) VALUES (?, ?)',
      args: [a.id, due.key],
    });
    if (claim.rowsAffected === 0) continue; // já enviado

    const delivered = await sendToAll({ title: a.title, body: reminderBody(a), url: '/#/agenda', tag: `activity-${a.id}` });
    console.log(`[reminders] "${a.title}" → ${delivered} dispositivo(s)`);
    sent.push(a.title);
  }

  // Limpeza ocasional do histórico.
  if (recent.at(-1)!.key.endsWith('T0000')) {
    await db.execute("DELETE FROM notification_log WHERE fire_key < date('now', '-7 days')");
  }

  return { sent };
}
