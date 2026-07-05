export interface BattleMonster {
  id: number;
  name: string;
  maxHp: number;
  currentHp: number;
  damage: number;
  attackSpeed: number;
}

// --- Combat state views (mirror of shared/src/interfaces/battle.interface.ts) ---

export type StatusKind = 'BUFF' | 'DEBUFF';

export interface StatusView {
  code: string;
  name: string;
  icon: string;
  kind: StatusKind;
  stacks: number;
  remainingTicks: number;
  description: string;
}

export interface SkillView {
  code: string;
  name: string;
  description: string;
  icon: string;
  momentumCost: number;
  momentumGain: number;
  remainingCooldownMs: number;
  ready: boolean;
  blockedReason?: string;
}

export type IntentKind = 'ATTACK' | 'HEAVY' | 'DEFEND' | 'ABILITY';

export interface MonsterIntentView {
  kind: IntentKind;
  label: string;
  icon: string;
  estimatedDamage?: number;
}

export type CombatEventTone = 'player-hit' | 'monster-hit' | 'crit' | 'status' | 'heal' | 'info';

export interface CombatEventView {
  text: string;
  tone: CombatEventTone;
}

export interface BattleStateView {
  momentum: number;
  maxMomentum: number;
  playerStatuses: StatusView[];
  monsterStatuses: StatusView[];
  intent: MonsterIntentView | null;
  skills: SkillView[];
}

export interface ActiveBattle {
  id: number;
  monster: BattleMonster;
  attackCooldownMs: number;
  location?: string;
  subLocation?: string;
  riftBattle?: boolean;
  pendingMonsterDamage?: number;
  startedAt?: string;
  state?: BattleStateView;
}

export type BattleStatus = 'ACTIVE' | 'WON' | 'LOST' | 'FLED';

export interface AttackResult {
  skillUsed: string;
  playerDamageDealt: number;
  monsterDamageDealt: number;
  monsterCurrentHp: number;
  monsterMaxHp: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  battleStatus: BattleStatus;
  isCrit: boolean;
  evaded: number;
  events: CombatEventView[];
  state: BattleStateView | null;
  expGained: number;
  goldGained: number;
  leveledUp: boolean;
  statPointsGained: number;
  perkPointsGained: number;
  playerDied: boolean;
  attackCooldownMs: number;
  newPosition?: { x: number; y: number };
  // `banked: true` (gate items) landed in the real inventory immediately;
  // everything else went into the at-risk rift bag pending extraction.
  lootDrops?: { name: string; quantity: number; rarity: 'COMMON' | 'UNCOMMON' | 'RARE'; banked?: boolean }[];
  // Fight happened inside a rift: table loot went to the at-risk rift bag.
  riftBattle?: boolean;
  // Set when a rift death forfeited part of the staged rift bag.
  lostLoot?: { name: string; quantity: number; rarity: 'COMMON' | 'UNCOMMON' | 'RARE' }[];
}

const LOG_LIMIT = 40;

export const useBattleStore = defineStore('battle', () => {
  const battle = ref<ActiveBattle | null>(null);
  const state = ref<BattleStateView | null>(null);
  const log = ref<CombatEventView[]>([]);
  const lastResult = ref<AttackResult | null>(null);
  const cooldownUntil = ref(0);
  // Per-skill cooldown deadlines, anchored to the client clock on each response.
  const skillCooldownUntil = ref<Record<string, number>>({});
  const loading = ref(false);

  const canAttack = computed(() => Date.now() >= cooldownUntil.value && !!battle.value);
  const cooldownRemaining = computed(() => Math.max(0, cooldownUntil.value - Date.now()));

  async function fetchCurrent() {
    const { request } = useApi();
    const data = await request<{ activeBattle: ActiveBattle | null }>('/battle/current');
    battle.value = data.activeBattle;
    if (data.activeBattle?.state) applyState(data.activeBattle.state);
  }

  async function enter(subLocationId: number): Promise<{ isSafe: boolean; message: string }> {
    loading.value = true;
    try {
      const { request } = useApi();
      const data = await request<{ isSafe: boolean; message: string; battle?: ActiveBattle }>(`/battle/enter/${subLocationId}`, { method: 'POST' });
      if (data.battle) {
        battle.value = data.battle;
        lastResult.value = null;
        log.value = [];
        if (data.battle.state) applyState(data.battle.state);
        setCooldown(data.battle.attackCooldownMs);
      }
      return { isSafe: data.isSafe, message: data.message };
    } finally {
      loading.value = false;
    }
  }

  async function useSkill(skillCode: string): Promise<AttackResult> {
    const { request } = useApi();
    const result = await request<AttackResult>('/battle/action', {
      method: 'POST',
      body: { skill: skillCode },
    });
    lastResult.value = result;
    log.value = [...log.value, ...result.events].slice(-LOG_LIMIT);

    if (battle.value) {
      battle.value.monster.currentHp = result.monsterCurrentHp;
    }

    if (result.battleStatus !== 'ACTIVE') {
      battle.value = null;
      state.value = null;
      skillCooldownUntil.value = {};
    } else {
      if (result.state) applyState(result.state);
      setCooldown(result.attackCooldownMs);
    }

    return result;
  }

  // Legacy shortcut: a plain attack is the Strike skill.
  function attack(): Promise<AttackResult> {
    return useSkill('strike');
  }

  async function flee(): Promise<{ message: string; hpLost: number; currentHp: number }> {
    const { request } = useApi();
    const result = await request<{ message: string; hpLost: number; currentHp: number }>('/battle/flee', { method: 'POST' });
    clear();
    return result;
  }

  function applyState(next: BattleStateView) {
    state.value = next;
    const now = Date.now();
    const deadlines: Record<string, number> = {};
    for (const skill of next.skills) {
      deadlines[skill.code] = now + skill.remainingCooldownMs;
    }
    skillCooldownUntil.value = deadlines;
  }

  function setCooldown(ms: number) {
    cooldownUntil.value = Date.now() + ms;
  }

  function clear() {
    battle.value = null;
    state.value = null;
    log.value = [];
    lastResult.value = null;
    cooldownUntil.value = 0;
    skillCooldownUntil.value = {};
  }

  return {
    battle,
    state,
    log,
    lastResult,
    cooldownUntil,
    skillCooldownUntil,
    loading,
    canAttack,
    cooldownRemaining,
    fetchCurrent,
    enter,
    useSkill,
    attack,
    flee,
    clear,
  };
});
