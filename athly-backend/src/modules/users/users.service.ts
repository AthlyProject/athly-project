import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { UserModel } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async findOrCreateByEmail(email: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      return existing;
    }

    const name = email.split('@')[0] || 'Usuário';
    const username = email.split('@')[0] || 'user';
    const hashedPassword = (await bcrypt.hash(password, 10)) as string;

    return this.prisma.user.create({
      data: {
        email,
        username,
        name,
        password: hashedPassword,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: Partial<UserModel>,
    password?: string,
  ): Promise<UserModel> {
    const updateData: Partial<User> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.height !== undefined) updateData.height = data.height;
    if (data.goals !== undefined) updateData.goals = data.goals;
    if (data.availability !== undefined) updateData.availability = data.availability;
    if (password !== undefined) {
      updateData.password = (await bcrypt.hash(password, 10)) as string;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.toUserModel(updated);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  toUserModel(user: User): UserModel {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      dateOfBirth: user.dateOfBirth ?? undefined,
      weight: user.weight ?? undefined,
      height: user.height ?? undefined,
      goals: user.goals ?? [],
      availability: user.availability ?? null,
      assessmentCompleted: user.assessmentCompleted,
    };
  }
}
