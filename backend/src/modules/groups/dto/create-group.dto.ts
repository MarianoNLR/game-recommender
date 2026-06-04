import {
  IsString,
  IsNumber,
  IsPositive,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  budget?: number;

  @IsString()
  creatorSteamId: string;
}
