import { IntegrationsService } from './integrations.service';
import { UserModel } from '../users/models/user.model';
import { StravaCallbackInput } from './dto/strava-callback.input';
export declare class IntegrationsController {
    private readonly integrationsService;
    constructor(integrationsService: IntegrationsService);
    integrations(user: UserModel): Promise<import("./models/integration.model").IntegrationModel[]>;
    connectIntegration(user: UserModel, integrationId: string): Promise<import("./models/integration.model").IntegrationModel>;
    disconnectIntegration(user: UserModel, integrationId: string): Promise<import("./models/integration.model").IntegrationModel>;
    getStravaAuthUrl(): {
        url: string;
    };
    handleStravaCallback(user: UserModel, input: StravaCallbackInput): Promise<import("./models/integration.model").IntegrationModel>;
    syncStrava(user: UserModel): Promise<{
        synced: number;
    }>;
    disconnectStrava(user: UserModel): Promise<void>;
}
