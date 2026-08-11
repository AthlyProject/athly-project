import { IsEnum, Matches } from 'class-validator';

export enum PushDeviceEnvironmentDto {
  sandbox = 'sandbox',
  production = 'production',
}

export class RegisterPushDeviceDto {
  @Matches(/^[0-9a-fA-F]{64}$/)
  token: string;

  @IsEnum(PushDeviceEnvironmentDto)
  environment: PushDeviceEnvironmentDto;
}
