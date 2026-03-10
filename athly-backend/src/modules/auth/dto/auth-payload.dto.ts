import { ApiProperty } from '@nestjs/swagger';
import { UserModel } from '../../users/models/user.model';

export class AuthPayload {
  @ApiProperty({ type: UserModel })
  user: UserModel;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}
