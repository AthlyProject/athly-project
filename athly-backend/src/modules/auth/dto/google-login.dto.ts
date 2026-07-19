import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'ID token (JWT) devolvido pelo GoogleSignIn no iOS' })
  @IsString()
  @IsNotEmpty({ message: 'idToken é obrigatório' })
  idToken: string;
}
