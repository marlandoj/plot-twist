/**
 * Generates the 14-day validated queue with per-day stats.
 *   npm run queue -- [startDate]   (default: today, UTC)
 * Writes data/queue.json. The scheduler keeps the live queue 14 days ahead in Redis
 * using the same generateDay(); this file is the reviewed, committed snapshot.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  addDays,
  generateDay,
  GREEDY_MAX,
  GREEDY_MIN,
  MAX_ROLLS,
  MIN_PERFECT_TOWNS,
  PERFECT_BANDS,
  utcDate,
} from '../src/shared/generator';
import { QUEUE_DAYS } from '../src/server/core/days';

const start = process.argv[2] ?? utcDate();
const t0 = Date.now();
const days = [];
for (let i = 0; i < QUEUE_DAYS; i++) {
  const date = addDays(start, i);
  const d0 = Date.now();
  const { stats } = generateDay(date);
  const ms = Date.now() - d0;
  days.push({ postData: { game: 'plot-twist', date, roll: stats.roll }, stats, generationMs: ms });
  console.log(
    `${date} ${stats.weekday.padEnd(9)} roll=${String(stats.roll).padStart(3)} wishes=${stats.wishes} ` +
      `optimum=${stats.optimum} perfect=${String(stats.perfectCount).padStart(5)} greedy=${stats.greedyScore}/${stats.optimum} ` +
      `(${stats.greedyRatio}) rejected=${stats.rejectedRolls} ${ms}ms`
  );
}

const out = {
  generatedFrom: start,
  gates: {
    perfectExists: 'optimum == number of wishes and at least 1 perfect town',
    threePerfect: `at least ${MIN_PERFECT_TOWNS} distinct perfect towns`,
    greedyBand: `greedy town scores between ${GREEDY_MIN * 100}% and ${GREEDY_MAX * 100}% of optimum`,
    weekdayRamp: PERFECT_BANDS.map((b) => ({ min: b.min, max: Number.isFinite(b.max) ? b.max : null })),
    maxRolls: MAX_ROLLS,
  },
  days,
};
writeFileSync(resolve(import.meta.dirname, '../data/queue.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote data/queue.json (${days.length} days) in ${Date.now() - t0}ms`);
