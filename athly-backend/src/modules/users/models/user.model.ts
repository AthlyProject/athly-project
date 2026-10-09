import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';

export class UserModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  gender?: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: RoleEnum })
  role: RoleEnum;

  @ApiPropertyOptional()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  weight?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiPropertyOptional({ type: [String] })
  goals?: string[];

  @ApiPropertyOptional({ type: [String] })
  availableDays?: string[];

  @ApiPropertyOptional()
  fitnessLevel?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  restingHeartRate?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  maxHeartRate?: number | null;

  @ApiProperty()
  assessmentCompleted: boolean;

  // Login social: quais provedores estão vinculados e se há senha (necessária p/ desvincular).
  @ApiProperty()
  appleLinked: boolean;

  @ApiProperty()
  googleLinked: boolean;

  @ApiProperty()
  hasPassword: boolean;

  // Aceite legal: data e versão aceitas de cada documento.
  @ApiPropertyOptional()
  termsAcceptedAt?: Date;

  @ApiPropertyOptional()
  termsVersion?: string;

  @ApiPropertyOptional()
  privacyAcceptedAt?: Date;

  @ApiPropertyOptional()
  privacyVersion?: string;

  /** `true` → o app deve bloquear o uso até o usuário aceitar as versões vigentes. */
  @ApiProperty()
  legalConsentRequired: boolean;
}
