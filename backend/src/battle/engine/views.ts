import type { BattleStateView, IntentKind, MonsterIntentView, SkillView, StatusView } from '@my/shared';
import type { BattleRuntimeState, EngineContext, StatusInstance } from './types';
import { damageReduction } from '../../character/stats.formulas';
import { MAX_MOMENTUM, SKILL_DEFINITIONS } from './skills.config';
import { HEAVY_DAMAGE_MULT } from './monster-ai.config';
import { STATUS_META } from './statuses.config';

const INTENT_META: Record<IntentKind, { label: string; icon: string }> = {
  ATTACK: { label: 'Preparing to attack', icon: 'mdi-sword-cross' },
  HEAVY: { label: 'Winding up a HEAVY blow', icon: 'mdi-hammer' },
  DEFEND: { label: 'Taking a defensive stance', icon: 'mdi-shield' },
  ABILITY: { label: 'Preparing something nasty', icon: 'mdi-flask' },
};

export function buildStateView(ctx: EngineContext, state: BattleRuntimeState, now: number): BattleStateView {
  return {
    momentum: state.momentum,
    maxMomentum: MAX_MOMENTUM,
    playerStatuses: state.playerStatuses.map(statusView),
    monsterStatuses: state.monsterStatuses.map(statusView),
    intent: intentView(ctx, state),
    skills: SKILL_DEFINITIONS.map((skill) => {
      const remainingCooldownMs = Math.max(0, (state.skillReadyAt[skill.code] ?? 0) - now);
      const lacksMomentum = state.momentum < skill.momentumCost;
      const view: SkillView = {
        code: skill.code,
        name: skill.name,
        description: skill.description,
        icon: skill.icon,
        momentumCost: skill.momentumCost,
        momentumGain: skill.momentumGain,
        remainingCooldownMs,
        ready: remainingCooldownMs <= 0 && !lacksMomentum,
      };
      if (lacksMomentum) view.blockedReason = `Needs ${skill.momentumCost} momentum`;
      else if (remainingCooldownMs > 0) view.blockedReason = 'On cooldown';
      return view;
    }),
  };
}

function statusView(status: StatusInstance): StatusView {
  const meta = STATUS_META[status.code];
  return {
    code: status.code,
    name: meta.name,
    icon: meta.icon,
    kind: meta.kind,
    stacks: status.stacks,
    remainingTicks: status.remainingTicks,
    description: meta.description,
  };
}

function intentView(ctx: EngineContext, state: BattleRuntimeState): MonsterIntentView {
  const kind = state.intent.kind;
  const meta = INTENT_META[kind];
  const view: MonsterIntentView = { kind, label: meta.label, icon: meta.icon };
  if (kind === 'ATTACK' || kind === 'HEAVY') {
    const raw = ctx.monster.damage * (kind === 'HEAVY' ? HEAVY_DAMAGE_MULT : 1);
    view.estimatedDamage = Math.max(1, Math.round(raw * (1 - damageReduction(ctx.player.defense))));
  }
  return view;
}
