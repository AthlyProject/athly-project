
# PerformanceHealthDto


## Properties

Name | Type
------------ | -------------
`referenceDistance` | string
`bestTime` | string
`sleepQuality` | number
`hasChronicPain` | string
`chronicPainDescription` | string

## Example

```typescript
import type { PerformanceHealthDto } from ''

// TODO: Update the object below with actual values
const example = {
  "referenceDistance": null,
  "bestTime": null,
  "sleepQuality": null,
  "hasChronicPain": null,
  "chronicPainDescription": null,
} satisfies PerformanceHealthDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PerformanceHealthDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


