import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { SubLocationKind } from '../../prisma/generated/client/enums';

interface PlayerPosition {
  currentLocationId: number | null;
  posX: number;
  posY: number;
}

interface SubLocationTile {
  kind: string;
  locationId: number;
  gridX: number;
  gridY: number;
}

// Tile services (shops, loot buyers, forges) all share the same physical-
// presence rule: the sub-location must be of the expected kind AND the player
// must actually be standing on its tile — knowing its id is not enough.
export function assertStandingAt(user: PlayerPosition, subLocation: SubLocationTile, kind: SubLocationKind, messages: { wrongKind: string; notPresent: string }): void {
  if (subLocation.kind !== kind) throw new BadRequestException(messages.wrongKind);
  if (user.currentLocationId !== subLocation.locationId || user.posX !== subLocation.gridX || user.posY !== subLocation.gridY) {
    throw new ForbiddenException(messages.notPresent);
  }
}
