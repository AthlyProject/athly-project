export interface EffortZoneData {
  vdotScore: number | null;
  maxHeartRate: number | null;
  restHeartRate: number | null;
  dataSource: 'apple_health' | 'assessment';
  easyPaceMin: number;      // seconds per km
  easyPaceMax: number;
  marathonPaceMin: number;
  marathonPaceMax: number;
  thresholdPaceMin: number;
  thresholdPaceMax: number;
  intervalPaceMin: number;
  intervalPaceMax: number;
  repetitionPaceMin: number;
  repetitionPaceMax: number;
  hrZones: HrZones | null;
  calculatedFrom: CalculationMetadata;
}

export interface HrZones {
  zone1: { min: number; max: number };  // Easy
  zone2: { min: number; max: number };  // Marathon
  zone3: { min: number; max: number };  // Threshold
  zone4: { min: number; max: number };  // Interval
  zone5: { min: number; max: number };  // Repetition
}

export interface CalculationMetadata {
  runCount: number;
  bestEffortDistanceKm: number;
  bestEffortPace: string;
  bestEffortDurationMin: number;
  calculatedAt: string;
}

export interface RunDataForZones {
  distanceMeters: number;
  durationSeconds: number;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
}

export interface FormattedZones {
  formatted: string;
  vdotScore: number | null;
}
