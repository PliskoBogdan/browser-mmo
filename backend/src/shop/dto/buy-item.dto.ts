import { IsInt } from 'class-validator';

export class BuyItemDto {
  @IsInt()
  equipmentItemId: number;
}
