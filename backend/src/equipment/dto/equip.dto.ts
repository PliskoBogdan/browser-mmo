import { IsIn, IsInt } from 'class-validator';
import { EQUIPMENT_SLOTS } from '../../character/stats.constants';
import type { EquipmentSlot } from '@my/shared';

export class EquipDto {
  @IsInt()
  ownedId: number;
}

export class UnequipDto {
  @IsIn(EQUIPMENT_SLOTS)
  slot: EquipmentSlot;
}
