
# SegmentDto


## Properties

Name | Type
------------ | -------------
`label` | string
`index` | number
`distanceKm` | number
`durationSeconds` | number
`avgPaceSecondsPerKm` | number
`avgHR` | number
`peakHR` | number
`endHR` | number

## Example

```typescript
import type { SegmentDto } from ''

// TODO: Update the object below with actual values
const example = {
  "label": null,
  "index": null,
  "distanceKm": null,
  "durationSeconds": null,
  "avgPaceSecondsPerKm": null,
  "avgHR": null,
  "peakHR": null,
  "endHR": null,
} satisfies SegmentDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SegmentDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


