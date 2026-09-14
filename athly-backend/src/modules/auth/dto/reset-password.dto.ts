import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Código inválido' })
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter letras maiúsculas, minúsculas e números',
  })
  newPassword: string;
}
