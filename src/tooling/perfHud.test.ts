/**
 * @vitest-environment happy-dom
 *
 * Perf HUD — issue #37.
 * Asserts the panel mounts, refreshes from the monitor, and toggles off.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERF } from '../config/perf';
import { PerfHud } from './perfHud';
import { emptyPerfPools, PerfMonitor } from './perfMonitor';

describe('PerfHud (#37)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts a live status line and toggles visibility (AC: perf HUD)', () => {
    const monitor = new PerfMonitor();
    const dt = PERF.desktopFrameBudgetMs;
    for (let i = 0; i < 30; i += 1) {
      monitor.sample(
        dt,
        emptyPerfPools({
          bulletsActive: 10,
          bulletsCapacity: 64,
          helisActive: 2,
          helisMax: 6,
        }),
      );
    }

    const hud = new PerfHud({
      monitor,
      parent: document.body,
      visible: true,
    });
    const root = document.querySelector('[data-perf-hud="true"]');
    expect(root).not.toBeNull();
    expect(hud.visible).toBe(true);

    const stats = hud.refresh();
    expect(stats.meetsDesktop).toBe(true);
    expect(stats.meetsMobile).toBe(true);

    const status = document.querySelector('[data-testid="perf-status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('60fps=OK');
    expect(status!.textContent).toContain('30fps=OK');
    expect(status!.textContent).toContain('bullets 10/64');
    expect(status!.textContent).toContain('helis 2/6');
    expect(root!.textContent).toContain('60fps desktop');
    expect(root!.textContent).toContain('≥30fps mobile');

    hud.toggle();
    expect(hud.visible).toBe(false);
    expect((root as HTMLElement).style.display).toBe('none');

    hud.destroy();
    expect(document.querySelector('[data-perf-hud="true"]')).toBeNull();
  });

  it('defaults hidden as part of End-toggled debug info (#107)', () => {
    const hud = new PerfHud({
      monitor: new PerfMonitor(),
      parent: document.body,
    });
    expect(hud.visible).toBe(false);
    expect(PERF.defaultHudVisible).toBe(false);
    hud.destroy();
  });
});
