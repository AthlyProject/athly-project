
# AiPlannerResultModel


## Properties

Name | Type
------------ | -------------
`trainingPlan` | [TrainingPlanModel](TrainingPlanModel.md)
`weeklyGoal` | [WeeklyGoalModel](WeeklyGoalModel.md)
`workouts` | [Array&lt;WorkoutModel&gt;](WorkoutModel.md)
`analysis` | object
`isAssessment` | boolean

## Example

```typescript
import type { AiPlannerResultModel } from ''

// TODO: Update the object below with actual values
const example = {
  "trainingPlan": null,
  "weeklyGoal": null,
  "workouts": null,
  "analysis": null,
  "isAssessment": null,
} satisfies AiPlannerResultModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AiPlannerResultModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


