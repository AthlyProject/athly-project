import { Injectable } from '@nestjs/common';
import {
  CodedBadRequestException,
  CodedNotFoundException,
} from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { UserModel } from './models/user.model';
import { LEGAL_DOCUMENT_VERSIONS } from '../../common/legal/legal-documents';
import { calculateHeartRateZones } from './heart-rate-zones';

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
    const hashedPassword = (await bcrypt.hash(password, 10)) as string;

    return this.prisma.user.create({
      data: {
        email,
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
    if (
      data.restingHeartRate !== undefined ||
      data.maxHeartRate !== undefined ||
      data.dateOfBirth !== undefined
    ) {
      const current = await this.findById(userId);
      if (!current) throw new CodedNotFoundException(ErrorCode.USER_NOT_FOUND, 'User not found');
      const effective = calculateHeartRateZones({
        ...current,
        restingHeartRate:
          data.restingHeartRate !== undefined ? data.restingHeartRate : current.restingHeartRate,
        maxHeartRate: data.maxHeartRate !== undefined ? data.maxHeartRate : current.maxHeartRate,
        dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : current.dateOfBirth,
      });
      if (effective.missingData.includes('invalid_heart_rate_range')) {
        throw new CodedBadRequestException(
          ErrorCode.HEART_RATE_RANGE_INVALID,
          'Revise a FC de repouso e a FC máxima: os valores precisam formar cinco zonas válidas.',
        );
      }
    }
    const updateData: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.height !== undefined) updateData.height = data.height;
    if (data.goals !== undefined) updateData.goals = data.goals;
    if (data.availableDays !== undefined) updateData.availableDays = data.availableDays;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.restingHeartRate !== undefined) updateData.restingHeartRate = data.restingHeartRate;
    if (data.maxHeartRate !== undefined) updateData.maxHeartRate = data.maxHeartRate;
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
      throw new CodedNotFoundException(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /** Campos que registram o aceite das versões vigentes dos Termos e da Política de Privacidade. */
  legalConsentData(acceptedAt: Date = new Date()) {
    return {
      termsAcceptedAt: acceptedAt,
      termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
      privacyAcceptedAt: acceptedAt,
      privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
    };
  }

  /** Falta aceite, ou o aceite registrado é de uma versão anterior de algum dos documentos. */
  isLegalConsentRequired(user: Pick<User, 'termsVersion' | 'privacyVersion'>): boolean {
    return (
      user.termsVersion !== LEGAL_DOCUMENT_VERSIONS.terms ||
      user.privacyVersion !== LEGAL_DOCUMENT_VERSIONS.privacy
    );
  }

  async acceptLegalConsent(userId: string): Promise<UserModel> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: this.legalConsentData(),
    });
    return this.toUserModel(updated);
  }

  toUserModel(user: User): UserModel {
    return {
      id: user.id,
      name: user.name,
      username: user.username ?? undefined,
      email: user.email,
      role: user.role,
      dateOfBirth: user.dateOfBirth ?? undefined,
      weight: user.weight ?? undefined,
      height: user.height ?? undefined,
      goals: user.goals ?? [],
      availableDays: user.availableDays ?? [],
      gender: user.gender ?? undefined,
      fitnessLevel: user.fitnessLevel ?? undefined,
      restingHeartRate: user.restingHeartRate ?? undefined,
      maxHeartRate: user.maxHeartRate ?? undefined,
      assessmentCompleted: user.assessmentCompleted,
      appleLinked: !!user.appleUserId,
      googleLinked: !!user.googleUserId,
      hasPassword: !!user.password,
      termsAcceptedAt: user.termsAcceptedAt ?? undefined,
      termsVersion: user.termsVersion ?? undefined,
      privacyAcceptedAt: user.privacyAcceptedAt ?? undefined,
      privacyVersion: user.privacyVersion ?? undefined,
      legalConsentRequired: this.isLegalConsentRequired(user),
    };
  }
}
