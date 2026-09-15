import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  // Sem regra de tamanho: a política de senha vale no cadastro/redefinição. Aqui ela só
  // vazaria o critério antigo e devolveria VALIDATION_PASSWORD_MIN_LENGTH com um limite
  // diferente do que o app traduz. Senha errada é problema do confronto de credenciais.
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password: string;
}
