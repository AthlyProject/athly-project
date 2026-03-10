import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterUserInput } from './dto/register-user.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly usersService;
    private readonly jwtService;
    private readonly config;
    constructor(prisma: PrismaService, usersService: UsersService, jwtService: JwtService, config: ConfigService);
    register(input: RegisterUserInput): Promise<{
        user: import("../users/models/user.model").UserModel;
        accessToken: string;
        refreshToken: string;
    }>;
    login(email: string, password: string): Promise<{
        user: import("../users/models/user.model").UserModel;
        accessToken: string;
        refreshToken: string;
    }>;
    validateUser(userId: string): Promise<import("../users/models/user.model").UserModel>;
    private signAccessToken;
    private createSession;
    private calculateExpiry;
}
