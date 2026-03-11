
# UpdateProfileInput


## Properties

Name | Type
------------ | -------------
`name` | string
`email` | string
`role` | object
`dateOfBirth` | string
`weight` | number
`height` | number
`goals` | Array&lt;string&gt;
`availability` | number
`password` | string

## Example

```typescript
import type { UpdateProfileInput } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "email": null,
  "role": null,
  "dateOfBirth": null,
  "weight": null,
  "height": null,
  "goals": null,
  "availability": null,
  "password": null,
} satisfies UpdateProfileInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateProfileInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


