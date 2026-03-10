
# IntegrationModel


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`icon` | string
`connected` | boolean
`type` | string
`stravaAthleteId` | object

## Example

```typescript
import type { IntegrationModel } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "icon": null,
  "connected": null,
  "type": null,
  "stravaAthleteId": null,
} satisfies IntegrationModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as IntegrationModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


