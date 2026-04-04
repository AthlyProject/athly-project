
# TrainingPlanningDto


## Properties

Name | Type
------------ | -------------
`availableDays` | Array&lt;string&gt;
`startDate` | string
`hasTargetDate` | string
`targetDate` | string

## Example

```typescript
import type { TrainingPlanningDto } from ''

// TODO: Update the object below with actual values
const example = {
  "availableDays": null,
  "startDate": null,
  "hasTargetDate": null,
  "targetDate": null,
} satisfies TrainingPlanningDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TrainingPlanningDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


