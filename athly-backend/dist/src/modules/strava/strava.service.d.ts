import { PrismaService } from '../../database/prisma.service';
import { StravaRawActivity } from './strava.mapper';
export declare class StravaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    syncActivities(userId: string, accessToken: string): Promise<{
        synced: number;
    }>;
    getRecentRunActivities(accessToken: string, count: number): Promise<StravaRawActivity[]>;
    private fetchActivities;
}
