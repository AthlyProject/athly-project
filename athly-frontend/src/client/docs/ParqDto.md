
# ParqDto


## Properties

Name | Type
------------ | -------------
`heartCondition` | boolean
`chestPainDuringActivity` | boolean
`chestPainLastMonth` | boolean
`dizzinessOrLossOfConsciousness` | boolean
`boneJointProblem` | boolean
`takingBloodPressureMeds` | boolean
`otherReasonToAvoidExercise` | boolean

## Example

```typescript
import type { ParqDto } from ''

// TODO: Update the object below with actual values
const example = {
  "heartCondition": null,
  "chestPainDuringActivity": null,
  "chestPainLastMonth": null,
  "dizzinessOrLossOfConsciousness": null,
  "boneJointProblem": null,
  "takingBloodPressureMeds": null,
  "otherReasonToAvoidExercise": null,
} satisfies ParqDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ParqDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


