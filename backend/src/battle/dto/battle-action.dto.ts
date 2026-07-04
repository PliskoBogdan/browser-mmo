import { IsString } from 'class-validator';

export class BattleActionDto {
  @IsString()
  skill: string;
}
