
# UserModel


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`email` | string
`role` | string
`dateOfBirth` | Date
`weight` | number
`height` | number
`goals` | Array&lt;string&gt;
`availability` | number

## Example

```typescript
import type { UserModel } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "email": null,
  "role": null,
  "dateOfBirth": null,
  "weight": null,
  "height": null,
  "goals": null,
  "availability": null,
} satisfies UserModel

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserModel
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


