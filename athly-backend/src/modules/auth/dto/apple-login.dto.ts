import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
