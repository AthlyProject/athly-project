import { IsString, IsNotEmpty } from 'class-validator';

export class StravaCallbackInput {
  @IsString()
  @IsNotEmpty()
  code: string;
}
