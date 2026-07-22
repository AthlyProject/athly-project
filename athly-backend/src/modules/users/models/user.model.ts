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

  @ApiProperty()
  assessmentCompleted: boolean;

  // Login social: quais provedores estão vinculados e se há senha (necessária p/ desvincular).
  @ApiProperty()
  appleLinked: boolean;

  @ApiProperty()
  googleLinked: boolean;

  @ApiProperty()
  hasPassword: boolean;
}
