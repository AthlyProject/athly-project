
# SubmitWorkoutFeedbackInput


## Properties

Name | Type
------------ | -------------
`completed` | boolean
`effort` | number
`fatigue` | number

## Example

```typescript
import type { SubmitWorkoutFeedbackInput } from ''

// TODO: Update the object below with actual values
const example = {
  "completed": null,
  "effort": null,
  "fatigue": null,
} satisfies SubmitWorkoutFeedbackInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SubmitWorkoutFeedbackInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


