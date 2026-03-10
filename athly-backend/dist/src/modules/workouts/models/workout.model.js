"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkoutFeedbackModel = exports.TrainingPlanModel = exports.WeekModel = exports.WorkoutModel = exports.WorkoutBlock = void 0;
class WorkoutBlock {
    type;
    duration;
    distance;
    targetPace;
    instructions;
}
exports.WorkoutBlock = WorkoutBlock;
class WorkoutModel {
    id;
    date;
    sportType;
    title;
    description;
    blocks;
    status;
    intensity;
    stravaActivityId;
}
exports.WorkoutModel = WorkoutModel;
class WeekModel {
    number;
    workouts;
}
exports.WeekModel = WeekModel;
class TrainingPlanModel {
    id;
    startDate;
    weeks;
}
exports.TrainingPlanModel = TrainingPlanModel;
class WorkoutFeedbackModel {
    workoutId;
    completed;
    effort;
    fatigue;
}
exports.WorkoutFeedbackModel = WorkoutFeedbackModel;
//# sourceMappingURL=workout.model.js.map