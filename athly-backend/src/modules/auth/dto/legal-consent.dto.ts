import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';

/** Aceite explícito e separado dos Termos de Uso e da Política de Privacidade. */
export class LegalConsentDto {
  @ApiProperty({ description: 'Aceite dos Termos de Uso (deve ser true)' })
  @Equals(true, { message: 'Você precisa aceitar os Termos de Uso' })
  termsAccepted: boolean;

  @ApiProperty({ description: 'Aceite da Política de Privacidade (deve ser true)' })
  @Equals(true, { message: 'Você precisa aceitar a Política de Privacidade' })
  privacyAccepted: boolean;
}
