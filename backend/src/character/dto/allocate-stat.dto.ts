import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CORE_STATS } from '../stats.constants';
import type { CoreStat } from '@my/shared';

export class AllocateStatDto {
  @IsIn(CORE_STATS as unknown as string[])
  stat: CoreStat;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number = 1;
}
