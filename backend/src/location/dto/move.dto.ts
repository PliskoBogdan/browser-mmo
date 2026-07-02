import { IsInt, Min } from 'class-validator';

export class MoveDto {
  @IsInt()
  @Min(0)
  x: number;

  @IsInt()
  @Min(0)
  y: number;
}
