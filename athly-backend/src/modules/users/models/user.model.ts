import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';

export class UserModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

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

  @ApiPropertyOptional({ type: Number })
  availability?: number | null;
}
