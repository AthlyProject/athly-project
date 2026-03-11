
# WorkoutModel


## Properties

Name | Type
------------ | -------------
`id` | string
`date` | string
`sportType` | string
`title` | string
`description` | string
`blocks` | [Array&lt;WorkoutBlock&gt;](WorkoutBlock.md)
`status` | string
`trainingPlanId` | string
`weeklyGoalId` | string
`intensity` | number
`stravaActivityId` | object

## Example

```typescript
import type { WorkoutModel } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "date": null,
  "sportType": null,
  "title": null,
  "description": null,
  "blocks": null,
  "status": null,
  "trainingPlanId": null,
  "weeklyGoalId": null,
  "intensity": null,
  "stravaActivityId": null,
} satisfies WorkoutModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WorkoutModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


