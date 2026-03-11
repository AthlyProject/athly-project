import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { CreateEquipmentInput } from './dto/create-equipment.dto';
import { UpdateEquipmentInput } from './dto/update-equipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';

@Controller('equipments')
@UseGuards(JwtAuthGuard)
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Get()
  getAllEquipments() {
    return this.equipmentsService.getAllEquipments();
  }

  @Get('my-equipments')
  getUserEquipments(@CurrentUser() user: UserModel) {
    return this.equipmentsService.getUserEquipments(user.id);
  }

  @Get(':uuid')
  getEquipmentById(@Param('uuid') uuid: string) {
    return this.equipmentsService.getEquipmentById(uuid);
  }

  @Post()
  createEquipment(@Body() input: CreateEquipmentInput) {
    return this.equipmentsService.createEquipment(input);
  }

  @Put(':uuid')
  updateEquipment(
    @Param('uuid') uuid: string,
    @Body() input: UpdateEquipmentInput,
  ) {
    return this.equipmentsService.updateEquipment(uuid, input);
  }

  @Delete(':uuid')
  deleteEquipment(@Param('uuid') uuid: string) {
    return this.equipmentsService.deleteEquipment(uuid);
  }

  @Post(':equipmentId/add')
  addEquipmentToUser(
    @CurrentUser() user: UserModel,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentsService.addEquipmentToUser(user.id, equipmentId);
  }

  @Delete(':equipmentId/remove')
  removeEquipmentFromUser(
    @CurrentUser() user: UserModel,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentsService.removeEquipmentFromUser(user.id, equipmentId);
  }
}
