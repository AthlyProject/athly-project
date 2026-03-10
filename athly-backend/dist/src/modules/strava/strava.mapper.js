"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStravaSportType = mapStravaSportType;
exports.deriveIntensity = deriveIntensity;
exports.formatPaceFromSpeed = formatPaceFromSpeed;
exports.buildStravaWorkoutBlock = buildStravaWorkoutBlock;
const client_1 = require("@prisma/client");
function mapStravaSportType(activity) {
    const type = activity.sport_type ?? activity.type ?? '';
    switch (type) {
        case 'Run':
        case 'TrailRun':
        case 'VirtualRun':
            return client_1.SportType.running;
        case 'Ride':
        case 'VirtualRide':
        case 'EBikeRide':
            return client_1.SportType.cycling;
        case 'Swim':
            return client_1.SportType.swimming;
        case 'WeightTraining':
            return client_1.SportType.strength;
        case 'CrossFit':
            return client_1.SportType.crossfit;
        case 'Walk':
        case 'Hike':
            return client_1.SportType.walking;
        case 'Yoga':
            return client_1.SportType.yoga;
        default:
            return client_1.SportType.other;
    }
}
function deriveIntensity(activity) {
    if (activity.suffer_score) {
        if (activity.suffer_score >= 150)
            return 10;
        if (activity.suffer_score >= 100)
            return 8;
        if (activity.suffer_score >= 50)
            return 6;
        return Math.max(1, Math.round(activity.suffer_score / 10));
    }
    if (activity.average_heartrate) {
        if (activity.average_heartrate >= 170)
            return 9;
        if (activity.average_heartrate >= 150)
            return 7;
        if (activity.average_heartrate >= 130)
            return 5;
        return 3;
    }
    return 5;
}
function formatPaceFromSpeed(speedMs) {
    if (!speedMs || speedMs <= 0)
        return 'N/A';
    const paceSecondsPerKm = 1000 / speedMs;
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
function buildStravaWorkoutBlock(activity) {
    const distanceKm = parseFloat((activity.distance / 1000).toFixed(2));
    const durationMinutes = Math.round(activity.moving_time / 60);
    const pace = activity.average_speed ? formatPaceFromSpeed(activity.average_speed) : null;
    const parts = [];
    if (activity.total_elevation_gain > 0) {
        parts.push(`Elevation: ${activity.total_elevation_gain}m`);
    }
    if (activity.average_heartrate) {
        parts.push(`Avg HR: ${Math.round(activity.average_heartrate)} bpm`);
    }
    return {
        type: 'strava_import',
        distanceKm,
        durationMinutes,
        targetPace: pace ?? undefined,
        instructions: parts.length > 0 ? parts.join(' | ') : 'Synced from Strava',
    };
}
//# sourceMappingURL=strava.mapper.js.map