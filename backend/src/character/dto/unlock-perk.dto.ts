import { IsString } from 'class-validator';

export class UnlockPerkDto {
  @IsString()
  code: string;
}
