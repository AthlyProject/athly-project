import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  Min,
  MinLength,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { RoleEnum } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: RoleEnum })
  @IsOptional()
  @IsEnum(RoleEnum)
  role?: RoleEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  goals?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], {
    each: true,
  })
  availableDays?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
