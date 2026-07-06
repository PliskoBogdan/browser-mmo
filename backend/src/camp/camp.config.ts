// What jumps a camping player, by level bracket. Names are resolved against
// the DB at camp time — keep in sync with seed.ts. The first entry whose
// minLevel the player meets wins (so order matters: highest bracket first).
export const AMBUSH_TABLE: { minLevel: number; monsterName: string }[] = [
  { minLevel: 10, monsterName: 'Ghoul' },
  { minLevel: 5, monsterName: 'Wolf' },
  { minLevel: 1, monsterName: 'Feral Hound' },
];
