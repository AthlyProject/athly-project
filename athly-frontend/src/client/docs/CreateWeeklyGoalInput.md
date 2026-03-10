
# CreateWeeklyGoalInput


## Properties

Name | Type
------------ | -------------
`trainingPlanId` | string
`weekStartDate` | string
`weekEndDate` | string
`metrics` | object

## Example

```typescript
import type { CreateWeeklyGoalInput } from ''

// TODO: Update the object below with actual values
const example = {
  "trainingPlanId": null,
  "weekStartDate": null,
  "weekEndDate": null,
  "metrics": null,
} satisfies CreateWeeklyGoalInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateWeeklyGoalInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


