import { ApiProperty } from '@nestjs/swagger';

export class EntitlementModel {
  @ApiProperty({ description: 'Se o usuário pode usar recursos pagos agora.' })
  entitled: boolean;

  @ApiProperty({ description: 'Se o usuário é admin/dev (isento de cobrança via ADMIN_EMAILS/role).' })
  isAdmin: boolean;

  @ApiProperty({ description: 'Se o e-mail do usuário está na waitlist e pode ver a oferta founder.' })
  isFounderEligible: boolean;

  @ApiProperty({
    description: 'Fim do trial backend (ISO). Null se não aplicável (admin, assinante ou expirado).',
    nullable: true,
    type: String,
  })
  trialEndsAt: string | null;

  @ApiProperty({
    description: 'Dias restantes do trial backend (arredondado p/ cima). Null se não aplicável.',
    nullable: true,
    type: Number,
  })
  trialDaysRemaining: number | null;
}
