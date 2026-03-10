import { IsString, IsNotEmpty } from 'class-validator';

export class CreateEquipmentInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  imagePath: string;
}
