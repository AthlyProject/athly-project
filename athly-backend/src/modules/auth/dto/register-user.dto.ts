import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsDateString,
  IsNumber,
  Min,
  IsNotEmpty,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter letras maiúsculas, minúsculas e números',
  })
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Confirmação de senha é obrigatória' })
  confirmPassword: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  @IsNotEmpty({ message: 'Data de nascimento é obrigatória' })
  dateOfBirth: string;

  @ApiProperty()
  @IsNumber({}, { message: 'Peso deve ser um número' })
  @Min(0, { message: 'Peso deve ser positivo' })
  @IsNotEmpty({ message: 'Peso é obrigatório' })
  weight: number;

  @ApiProperty()
  @IsNumber({}, { message: 'Altura deve ser um número' })
  @Min(0, { message: 'Altura deve ser positiva' })
  @IsNotEmpty({ message: 'Altura é obrigatória' })
  height: number;
}
