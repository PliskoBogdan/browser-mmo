export type CoreStat = 'strength' | 'agility' | 'accuracy' | 'endurance' | 'criticalDamage' | 'defense';
export type EquipmentSlot = 'WEAPON' | 'HELMET' | 'BODY' | 'PANTS' | 'GLOVES';
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE';

export interface StatBreakdown {
  base: number;
  equipment: number;
  perk: number;
  final: number;
}

export interface CombatProfile {
  maxHp: number;
  healthRegenPerCycle: number;
  evasionChance: number;
  critChance: number;
  critMultiplier: number;
  attackDamage: number;
  attackSpeed: number | null;
  attackCooldownMs: number | null;
}

export interface EquippedItem {
  ownedId: number;
  itemId: number;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  description: string | null;
  icon: string | null;
  minLevel: number;
  baseDamage: number;
  attackSpeed: number | null;
  modifiers: Partial<Record<CoreStat, number>>;
}

export interface OwnedGear extends EquippedItem {
  sellValue: number;
  equipped: boolean;
}

export interface PerkView {
  code: string;
  name: string;
  description: string;
  requiredLevel: number;
  unlocked: boolean;
  canUnlock: boolean;
}

export interface Character {
  id: number;
  username: string;
  email: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  statPoints: number;
  perkPoints: number;
  position: { locationId: number | null; x: number; y: number };
  stats: Record<CoreStat, StatBreakdown>;
  combat: CombatProfile;
  equipment: Record<EquipmentSlot, EquippedItem | null>;
  perks: string[];
  createdAt: string;
}

export const CORE_STATS: CoreStat[] = ['strength', 'agility', 'accuracy', 'endurance', 'criticalDamage', 'defense'];
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['WEAPON', 'HELMET', 'BODY', 'PANTS', 'GLOVES'];

export const useCharacterStore = defineStore('character', () => {
  const character = ref<Character | null>(null);
  const gear = ref<OwnedGear[]>([]);
  const perks = ref<PerkView[]>([]);
  const loading = ref(false);

  async function fetch() {
    loading.value = true;
    try {
      const { request } = useApi();
      character.value = await request<Character>('/character/me');
    } finally {
      loading.value = false;
    }
  }

  async function fetchGear() {
    const { request } = useApi();
    gear.value = await request<OwnedGear[]>('/equipment');
  }

  async function fetchPerks() {
    const { request } = useApi();
    perks.value = await request<PerkView[]>('/character/perks');
  }

  async function allocateStat(stat: CoreStat, points = 1) {
    const { request } = useApi();
    character.value = await request<Character>('/character/stats/allocate', { method: 'POST', body: { stat, points } });
  }

  async function unlockPerk(code: string) {
    const { request } = useApi();
    character.value = await request<Character>('/character/perks/unlock', { method: 'POST', body: { code } });
    await fetchPerks();
  }

  async function equip(ownedId: number) {
    const { request } = useApi();
    character.value = await request<Character>('/equipment/equip', { method: 'POST', body: { ownedId } });
    await fetchGear();
  }

  async function unequip(slot: EquipmentSlot) {
    const { request } = useApi();
    character.value = await request<Character>('/equipment/unequip', { method: 'POST', body: { slot } });
    await fetchGear();
  }

  async function resurrect() {
    const { request } = useApi();
    await request('/character/resurrect', { method: 'POST' });
    await fetch();
  }

  function clear() {
    character.value = null;
    gear.value = [];
    perks.value = [];
  }

  return { character, gear, perks, loading, fetch, fetchGear, fetchPerks, allocateStat, unlockPerk, equip, unequip, resurrect, clear };
});
