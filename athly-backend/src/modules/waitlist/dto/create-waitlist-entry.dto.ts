import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaitlistEntryDto {
  @ApiProperty({
    description: 'Nome completo',
    example: 'João Silva',
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  name: string;

  @ApiProperty({
    description: 'Email para contato',
    example: 'joao@email.com',
  })
  @IsEmail({}, { message: 'Informe um email válido.' })
  @IsNotEmpty({ message: 'O email é obrigatório.' })
  email: string;
}
