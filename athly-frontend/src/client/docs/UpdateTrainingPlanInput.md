
# UpdateTrainingPlanInput


## Properties

Name | Type
------------ | -------------
`startDate` | string
`weeks` | object
`objective` | string
`targetDate` | string
`sports` | Array&lt;object&gt;
`autoGenerate` | boolean

## Example

```typescript
import type { UpdateTrainingPlanInput } from ''

// TODO: Update the object below with actual values
const example = {
  "startDate": null,
  "weeks": null,
  "objective": null,
  "targetDate": null,
  "sports": null,
  "autoGenerate": null,
} satisfies UpdateTrainingPlanInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateTrainingPlanInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


