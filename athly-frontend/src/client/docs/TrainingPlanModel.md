
# TrainingPlanModel


## Properties

Name | Type
------------ | -------------
`id` | string
`startDate` | string
`objective` | string
`targetDate` | Date
`sports` | Array&lt;string&gt;
`autoGenerate` | boolean
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { TrainingPlanModel } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "startDate": null,
  "objective": null,
  "targetDate": null,
  "sports": null,
  "autoGenerate": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies TrainingPlanModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TrainingPlanModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


