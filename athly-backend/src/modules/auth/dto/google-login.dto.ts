import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'ID token (JWT) devolvido pelo GoogleSignIn no iOS' })
  @IsString()
  @IsNotEmpty({ message: 'idToken é obrigatório' })
  idToken: string;

  // Aceite legal: obrigatório quando o login cria uma conta nova (sem ele a API responde
  // AUTH_LEGAL_CONSENT_REQUIRED e o cliente pede o aceite e reenvia o mesmo token).
  @ApiPropertyOptional({ description: 'Aceite dos Termos de Uso' })
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  @ApiPropertyOptional({ description: 'Aceite da Política de Privacidade' })
  @IsOptional()
  @IsBoolean()
  privacyAccepted?: boolean;
}
