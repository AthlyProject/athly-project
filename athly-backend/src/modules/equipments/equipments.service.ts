import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentModel } from './models/equipment.model';

@Injectable()
export class EquipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEquipment(input: CreateEquipmentDto): Promise<EquipmentModel> {
    const equipment = await this.prisma.equipment.create({
      data: {
        name: input.name,
        imagePath: input.imagePath,
      },
    });

    return this.mapEquipment(equipment);
  }

  async getAllEquipments(): Promise<EquipmentModel[]> {
    const equipments = await this.prisma.equipment.findMany({
      orderBy: { name: 'asc' },
    });

    return equipments.map((equipment) => this.mapEquipment(equipment));
  }

  async getEquipmentById(uuid: string): Promise<EquipmentModel> {
    const equipment = await this.prisma.equipment.findUnique({
      where: { uuid },
    });

    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    return this.mapEquipment(equipment);
  }

  async updateEquipment(uuid: string, input: UpdateEquipmentDto): Promise<EquipmentModel> {
    const equipment = await this.prisma.equipment.update({
      where: { uuid },
      data: input,
    });

    return this.mapEquipment(equipment);
  }

  async deleteEquipment(uuid: string): Promise<void> {
    await this.prisma.equipment.delete({
      where: { uuid },
    });
  }

  async addEquipmentToUser(userId: string, equipmentId: string): Promise<void> {
    await this.prisma.userEquipment.create({
      data: {
        userId,
        equipmentId,
      },
    });
  }

  async removeEquipmentFromUser(userId: string, equipmentId: string): Promise<void> {
    await this.prisma.userEquipment.delete({
      where: {
        userId_equipmentId: {
          userId,
          equipmentId,
        },
      },
    });
  }

  async getUserEquipments(userId: string): Promise<EquipmentModel[]> {
    const userEquipments = await this.prisma.userEquipment.findMany({
      where: { userId },
      include: { equipment: true },
    });

    return userEquipments.map((ue) => this.mapEquipment(ue.equipment));
  }

  private mapEquipment(equipment: {
    uuid: string;
    name: string;
    imagePath: string;
    createdAt: Date;
    updatedAt: Date;
  }): EquipmentModel {
    return {
      uuid: equipment.uuid,
      name: equipment.name,
      imagePath: equipment.imagePath,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
    };
  }
}
