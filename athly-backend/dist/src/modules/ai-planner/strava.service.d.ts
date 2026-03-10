import { IntegrationsService } from '../integrations/integrations.service';
import type { StravaActivity } from './types/planner.types';
export declare class StravaService {
    private readonly integrationsService;
    constructor(integrationsService: IntegrationsService);
    getRecentActivities(userId: string, count: number): Promise<StravaActivity[]>;
}
