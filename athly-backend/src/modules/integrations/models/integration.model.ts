import { IntegrationType } from '@prisma/client';

export class IntegrationModel {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  type: IntegrationType;
  stravaAthleteId?: string | null;
}
