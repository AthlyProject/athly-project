
# PhysicalActivityDto


## Properties

Name | Type
------------ | -------------
`currentActivities` | Array&lt;string&gt;
`trainingPreparedBy` | string
`canRun3km` | string
`runningExperience` | string

## Example

```typescript
import type { PhysicalActivityDto } from ''

// TODO: Update the object below with actual values
const example = {
  "currentActivities": null,
  "trainingPreparedBy": null,
  "canRun3km": null,
  "runningExperience": null,
} satisfies PhysicalActivityDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PhysicalActivityDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


