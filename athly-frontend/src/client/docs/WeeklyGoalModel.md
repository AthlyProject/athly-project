
# WeeklyGoalModel


## Properties

Name | Type
------------ | -------------
`id` | string
`trainingPlanId` | string
`weekStartDate` | Date
`weekEndDate` | Date
`status` | string
`metrics` | object
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { WeeklyGoalModel } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "trainingPlanId": null,
  "weekStartDate": null,
  "weekEndDate": null,
  "status": null,
  "metrics": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies WeeklyGoalModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WeeklyGoalModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


