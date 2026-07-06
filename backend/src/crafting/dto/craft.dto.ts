import { IsInt } from 'class-validator';

export class CraftDto {
  @IsInt()
  recipeId: number;
}
