import type { TrainingGuidance } from '../heart-rate-guidance';
import { ApiProperty } from '@nestjs/swagger';
import type { HeartRateValue, HeartRateZones } from '../heart-rate-zones';

class HeartRateValueModel implements HeartRateValue {
  @ApiProperty() bpm: number;
  @ApiProperty({ enum: ['manual', 'apple_health', 'age_estimate'] })
  source: HeartRateValue['source'];
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) measuredAt: string | null;
}

class HeartRateZoneModel {
  @ApiProperty() zone: number;
  @ApiProperty() minBpm: number;
  @ApiProperty() maxBpm: number;
}

class TrainingGuidanceModel implements TrainingGuidance {
  @ApiProperty({ enum: ['rpe', 'heart_rate_and_rpe'] }) mode: TrainingGuidance['mode'];
  @ApiProperty({ enum: ['no_recent_heart_rate', 'missing_zone_inputs', 'available'] })
  reason: TrainingGuidance['reason'];
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) lastHeartRateRunAt:
    | string
    | null;
}

export class HeartRateZonesModel implements HeartRateZones {
  @ApiProperty({ type: TrainingGuidanceModel }) trainingGuidance: TrainingGuidance;
  @ApiProperty({ enum: ['available', 'insufficient_data'] }) status: HeartRateZones['status'];
  @ApiProperty({ enum: ['hrr_v1'] }) method: 'hrr_v1';
  @ApiProperty() isEstimated: boolean;
  @ApiProperty({
    enum: ['resting_heart_rate', 'max_heart_rate', 'invalid_heart_rate_range'],
    isArray: true,
  })
  missingData: HeartRateZones['missingData'];
  @ApiProperty({ type: HeartRateValueModel, nullable: true })
  restingHeartRate: HeartRateValue | null;
  @ApiProperty({ type: HeartRateValueModel, nullable: true }) maxHeartRate: HeartRateValue | null;
  @ApiProperty({ type: [HeartRateZoneModel] }) zones: HeartRateZones['zones'];
}
