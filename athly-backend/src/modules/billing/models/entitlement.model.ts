import { ApiProperty } from '@nestjs/swagger';

export class EntitlementModel {
  @ApiProperty({ description: 'Se o usuário pode usar recursos premium agora.' })
  entitled: boolean;

  @ApiProperty({ description: 'Se o usuário é admin/dev (isento de cobrança via ADMIN_EMAILS/role).' })
  isAdmin: boolean;
}
