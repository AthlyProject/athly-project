
# SubmitAssessmentDto


## Properties

Name | Type
------------ | -------------
`goals` | [GoalsDto](GoalsDto.md)
`activityHistory` | [PhysicalActivityDto](PhysicalActivityDto.md)
`trainingPlanning` | [TrainingPlanningDto](TrainingPlanningDto.md)
`performanceHealth` | [PerformanceHealthDto](PerformanceHealthDto.md)
`parq` | [ParqDto](ParqDto.md)
`gender` | string
`termsAccepted` | boolean

## Example

```typescript
import type { SubmitAssessmentDto } from ''

// TODO: Update the object below with actual values
const example = {
  "goals": null,
  "activityHistory": null,
  "trainingPlanning": null,
  "performanceHealth": null,
  "parq": null,
  "gender": null,
  "termsAccepted": null,
} satisfies SubmitAssessmentDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SubmitAssessmentDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


