
# HealthRunItemDto


## Properties

Name | Type
------------ | -------------
`startDate` | string
`distanceMeters` | number
`durationSeconds` | number
`averagePaceSecondsPerKm` | number
`activeEnergyBurned` | number
`elevationGainMeters` | number

## Example

```typescript
import type { HealthRunItemDto } from ''

// TODO: Update the object below with actual values
const example = {
  "startDate": null,
  "distanceMeters": null,
  "durationSeconds": null,
  "averagePaceSecondsPerKm": null,
  "activeEnergyBurned": null,
  "elevationGainMeters": null,
} satisfies HealthRunItemDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as HealthRunItemDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


