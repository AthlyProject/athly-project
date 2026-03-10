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

export class RegisterUserInput {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Username é obrigatório' })
  @MinLength(3, { message: 'Username deve ter no mínimo 3 caracteres' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username deve conter apenas letras, números, _ e -',
  })
  userName: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter letras maiúsculas, minúsculas e números',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirmação de senha é obrigatória' })
  confirmPassword: string;

  @IsDateString({}, { message: 'Data de nascimento inválida' })
  @IsNotEmpty({ message: 'Data de nascimento é obrigatória' })
  dateOfBirth: string;

  @IsNumber({}, { message: 'Peso deve ser um número' })
  @Min(0, { message: 'Peso deve ser positivo' })
  @IsNotEmpty({ message: 'Peso é obrigatório' })
  weight: number;

  @IsNumber({}, { message: 'Altura deve ser um número' })
  @Min(0, { message: 'Altura deve ser positiva' })
  @IsNotEmpty({ message: 'Altura é obrigatória' })
  height: number;
}
