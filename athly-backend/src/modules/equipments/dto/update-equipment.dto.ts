import { IsString, IsOptional } from 'class-validator';

export class UpdateEquipmentInput {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imagePath?: string;
}
