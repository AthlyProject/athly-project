import { IntegrationsService } from './integrations.service';
import { UserModel } from '../users/models/user.model';
import { StravaCallbackInput } from './dto/strava-callback.dto';
import { IntegrationModel } from './models/integration.model';
export declare class IntegrationsController {
    private readonly integrationsService;
    constructor(integrationsService: IntegrationsService);
    integrations(user: UserModel): Promise<IntegrationModel[]>;
    connectIntegration(user: UserModel, integrationId: string): Promise<IntegrationModel>;
    disconnectIntegration(user: UserModel, integrationId: string): Promise<IntegrationModel>;
    getStravaAuthUrl(): {
        url: string;
    };
    handleStravaCallback(user: UserModel, input: StravaCallbackInput): Promise<IntegrationModel>;
    syncStrava(user: UserModel): Promise<{
        synced: number;
    }>;
    disconnectStrava(user: UserModel): Promise<void>;
}
