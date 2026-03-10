import { EquipmentsService } from './equipments.service';
import { CreateEquipmentInput } from './dto/create-equipment.dto';
import { UpdateEquipmentInput } from './dto/update-equipment.dto';
import { UserModel } from '../users/models/user.model';
export declare class EquipmentsController {
    private readonly equipmentsService;
    constructor(equipmentsService: EquipmentsService);
    getAllEquipments(): Promise<import("./models/equipment.model").EquipmentModel[]>;
    getUserEquipments(user: UserModel): Promise<import("./models/equipment.model").EquipmentModel[]>;
    getEquipmentById(uuid: string): Promise<import("./models/equipment.model").EquipmentModel>;
    createEquipment(input: CreateEquipmentInput): Promise<import("./models/equipment.model").EquipmentModel>;
    updateEquipment(uuid: string, input: UpdateEquipmentInput): Promise<import("./models/equipment.model").EquipmentModel>;
    deleteEquipment(uuid: string): Promise<void>;
    addEquipmentToUser(user: UserModel, equipmentId: string): Promise<void>;
    removeEquipmentFromUser(user: UserModel, equipmentId: string): Promise<void>;
}
