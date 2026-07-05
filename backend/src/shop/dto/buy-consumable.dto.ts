import { IsInt } from 'class-validator';

export class BuyConsumableDto {
  @IsInt()
  itemId: number;
}
