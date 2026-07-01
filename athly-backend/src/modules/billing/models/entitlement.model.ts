import { ApiProperty } from '@nestjs/swagger';

export class EntitlementModel {
  @ApiProperty({ description: 'Se o usuário pode usar recursos pagos agora.' })
  entitled: boolean;

  @ApiProperty({ description: 'Se o usuário é admin/dev (isento de cobrança via ADMIN_EMAILS/role).' })
  isAdmin: boolean;

  @ApiProperty({ description: 'Se o e-mail do usuário está na waitlist e pode ver a oferta founder.' })
  isFounderEligible: boolean;
}
