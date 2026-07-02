export interface BattleMonster {
  id: number;
  name: string;
  maxHp: number;
  currentHp: number;
  damage: number;
  attackSpeed: number;
}

export interface ActiveBattle {
  id: number;
  monster: BattleMonster;
  attackCooldownMs: number;
  location?: string;
  subLocation?: string;
  pendingMonsterDamage?: number;
  startedAt?: string;
}

export type BattleStatus = 'ACTIVE' | 'WON' | 'LOST' | 'FLED';

export interface AttackResult {
  playerDamageDealt: number;
  monsterDamageDealt: number;
  monsterCurrentHp: number;
  monsterMaxHp: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  battleStatus: BattleStatus;
  expGained: number;
  goldGained: number;
  leveledUp: boolean;
  playerDied: boolean;
  attackCooldownMs: number;
}

export const useBattleStore = defineStore('battle', () => {
  const battle = ref<ActiveBattle | null>(null);
  const lastResult = ref<AttackResult | null>(null);
  const cooldownUntil = ref(0);
  const loading = ref(false);

  const canAttack = computed(() => Date.now() >= cooldownUntil.value && !!battle.value);
  const cooldownRemaining = computed(() => Math.max(0, cooldownUntil.value - Date.now()));

  async function fetchCurrent() {
    const { request } = useApi();
    const data = await request<{ activeBattle: ActiveBattle | null }>('/battle/current');
    battle.value = data.activeBattle;
  }

  async function enter(subLocationId: number): Promise<{ isSafe: boolean; message: string }> {
    loading.value = true;
    try {
      const { request } = useApi();
      const data = await request<{ isSafe: boolean; message: string; battle?: ActiveBattle }>(`/battle/enter/${subLocationId}`, { method: 'POST' });
      if (data.battle) {
        battle.value = data.battle;
        lastResult.value = null;
        setCooldown(data.battle.attackCooldownMs);
      }
      return { isSafe: data.isSafe, message: data.message };
    } finally {
      loading.value = false;
    }
  }

  async function attack(): Promise<AttackResult> {
    const { request } = useApi();
    const result = await request<AttackResult>('/battle/attack', { method: 'POST' });
    lastResult.value = result;

    if (battle.value) {
      battle.value.monster.currentHp = result.monsterCurrentHp;
    }

    if (result.battleStatus !== 'ACTIVE') {
      battle.value = null;
    } else {
      setCooldown(result.attackCooldownMs);
    }

    return result;
  }

  async function flee(): Promise<{ message: string; hpLost: number; currentHp: number }> {
    const { request } = useApi();
    const result = await request<{ message: string; hpLost: number; currentHp: number }>('/battle/flee', { method: 'POST' });
    battle.value = null;
    lastResult.value = null;
    return result;
  }

  function setCooldown(ms: number) {
    cooldownUntil.value = Date.now() + ms;
  }

  function clear() {
    battle.value = null;
    lastResult.value = null;
    cooldownUntil.value = 0;
  }

  return { battle, lastResult, cooldownUntil, loading, canAttack, cooldownRemaining, fetchCurrent, enter, attack, flee, clear };
});
