
# WorkoutBlock


## Properties

Name | Type
------------ | -------------
`type` | string
`duration` | number
`distance` | number
`targetPace` | string
`instructions` | string

## Example

```typescript
import type { WorkoutBlock } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "duration": null,
  "distance": null,
  "targetPace": null,
  "instructions": null,
} satisfies WorkoutBlock

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WorkoutBlock
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


