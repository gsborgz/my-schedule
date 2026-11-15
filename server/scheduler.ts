import { listActivities, type Activity } from './activities.ts';
import { config } from './config.ts';
import { db } from './db.ts';
import { sendToAll } from './push.ts';

const DAY = 1440;
const WEEK = 7 * DAY;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Data/hora atual no fuso configurado (independente do fuso do servidor). */
function nowInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    weekday: WEEKDAYS.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
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

const claim = db.prepare('INSERT OR IGNORE INTO notification_log (activity_id, fire_key) VALUES (?, ?)');

async function tick(): Promise<void> {
  const now = nowInTimeZone(config.timeZone);
  const nowOfWeek = now.weekday * DAY + now.minutes;
  const fireKey = `${now.date}T${String(now.minutes).padStart(4, '0')}`;

  for (const a of listActivities()) {
    if (!a.enabled || a.remindBefore === null) continue;
    const remindBefore = a.remindBefore;

    // Compara em "minutos da semana" para que um lembrete de 00:05 com 10 min de
    // antecedência dispare corretamente às 23:55 do dia anterior.
    const due = a.days.some((d) => {
      const fireAt = (((d * DAY + toMinutes(a.startTime) - remindBefore) % WEEK) + WEEK) % WEEK;
      return fireAt === nowOfWeek;
    });
    if (!due) continue;

    if (claim.run(a.id, fireKey).changes === 0) continue; // já enviado neste minuto

    const delivered = await sendToAll({ title: a.title, body: reminderBody(a), url: '/#/agenda', tag: `activity-${a.id}` });
    console.log(`[scheduler] "${a.title}" → ${delivered} dispositivo(s)`);
  }

  if (now.minutes === 0) {
    db.prepare("DELETE FROM notification_log WHERE fire_key < date('now', '-7 days')").run();
  }
}

export function startScheduler(): void {
  const run = () => tick().catch((err) => console.error('[scheduler]', err));
  run();
  setInterval(run, 20_000);
  console.log(`[scheduler] ativo (fuso: ${config.timeZone})`);
}
