
# CreateTrainingPlanInput


## Properties

Name | Type
------------ | -------------
`startDate` | string
`objective` | string
`status` | object
`targetDate` | string
`sports` | Array&lt;object&gt;
`autoGenerate` | boolean

## Example

```typescript
import type { CreateTrainingPlanInput } from ''

// TODO: Update the object below with actual values
const example = {
  "startDate": null,
  "objective": null,
  "status": null,
  "targetDate": null,
  "sports": null,
  "autoGenerate": null,
} satisfies CreateTrainingPlanInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateTrainingPlanInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


