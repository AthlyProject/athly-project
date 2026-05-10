
# DetailedSessionDto


## Properties

Name | Type
------------ | -------------
`startDate` | string
`appleHealthWorkoutUUID` | string
`athlyWorkoutId` | string
`distanceMeters` | number
`durationSeconds` | number
`averagePaceSecondsPerKm` | number
`avgHR` | number
`maxHR` | number
`activeEnergyBurned` | number
`elevationGainMeters` | number
`segments` | [Array&lt;SegmentDto&gt;](SegmentDto.md)

## Example

```typescript
import type { DetailedSessionDto } from ''

// TODO: Update the object below with actual values
const example = {
  "startDate": null,
  "appleHealthWorkoutUUID": null,
  "athlyWorkoutId": null,
  "distanceMeters": null,
  "durationSeconds": null,
  "averagePaceSecondsPerKm": null,
  "avgHR": null,
  "maxHR": null,
  "activeEnergyBurned": null,
  "elevationGainMeters": null,
  "segments": null,
} satisfies DetailedSessionDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DetailedSessionDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


