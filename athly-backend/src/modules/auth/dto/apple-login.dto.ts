import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Identity token (JWT) do Sign in with Apple' })
  @IsString()
  @IsNotEmpty({ message: 'identityToken é obrigatório' })
  identityToken: string;

  // O Apple só devolve o nome na primeira autorização; o cliente o repassa quando disponível.
  @ApiPropertyOptional({ description: 'Nome completo (apenas na primeira autorização)' })
  @IsOptional()
  @IsString()
  fullName?: string;

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
