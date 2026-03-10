import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { RoleEnum } from '@prisma/client';

export class UpdateProfileInput {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(RoleEnum)
  role?: RoleEnum;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @IsOptional()
  goals?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  availability?: number;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
