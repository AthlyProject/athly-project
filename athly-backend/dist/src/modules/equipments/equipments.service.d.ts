import { PrismaService } from '../../database/prisma.service';
import { CreateEquipmentInput } from './dto/create-equipment.dto';
import { UpdateEquipmentInput } from './dto/update-equipment.dto';
import { EquipmentModel } from './models/equipment.model';
export declare class EquipmentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createEquipment(input: CreateEquipmentInput): Promise<EquipmentModel>;
    getAllEquipments(): Promise<EquipmentModel[]>;
    getEquipmentById(uuid: string): Promise<EquipmentModel>;
    updateEquipment(uuid: string, input: UpdateEquipmentInput): Promise<EquipmentModel>;
    deleteEquipment(uuid: string): Promise<void>;
    addEquipmentToUser(userId: string, equipmentId: string): Promise<void>;
    removeEquipmentFromUser(userId: string, equipmentId: string): Promise<void>;
    getUserEquipments(userId: string): Promise<EquipmentModel[]>;
    private mapEquipment;
}
