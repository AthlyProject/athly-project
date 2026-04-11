import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({
    description: 'Objetivo de corrida em texto livre',
    example: 'Quero correr 10km em menos de 50 minutos',
  })
  @IsString()
  @MinLength(10, { message: 'Descreva seu objetivo com pelo menos 10 caracteres.' })
  @MaxLength(500, { message: 'O objetivo não pode ter mais de 500 caracteres.' })
  goalText: string;
}
