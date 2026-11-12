import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '@devvit/shared-types/schemas/config-file.v1.js';
import { Scope } from '@devvit/protos/json/reddit/devvit/app_permission/v1/app_permission.js';

const raw = readFileSync(resolve(import.meta.dirname, '../devvit.json'), 'utf8');

describe('devvit.json (validated by the Devvit SDK parser used at upload)', () => {
  const config = parseAppConfig(raw, false);

  it('is an inline, tall post that loads game.html', () => {
    expect(config.post?.entrypoints.default).toMatchObject({ inline: true, height: 'tall', entry: 'game.html' });
  });

  it('declares redis, journeys and the two user-scoped actions', () => {
    expect(config.permissions.redis).toBe(true);
    expect(config.permissions.journeys).toBe(true);
    expect([...config.permissions.reddit.asUser].sort()).toEqual([Scope.SUBMIT_COMMENT, Scope.SUBSCRIBE_TO_SUBREDDIT]);
  });

  it('schedules the daily rollover and the weekly Mayors Wall', () => {
    expect(config.scheduler?.tasks['daily-rollover']).toMatchObject({ cron: '0 0 * * *' });
    expect(config.scheduler?.tasks['mayors-wall']).toMatchObject({ cron: '15 0 * * 1' });
  });
});
