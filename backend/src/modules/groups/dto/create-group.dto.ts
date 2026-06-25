import {
  IsString,
  IsNumber,
  IsPositive,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  memberSteamIds: string[];
}
