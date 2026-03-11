
# RegisterUserInput


## Properties

Name | Type
------------ | -------------
`email` | string
`userName` | string
`name` | string
`password` | string
`confirmPassword` | string
`dateOfBirth` | string
`weight` | number
`height` | number

## Example

```typescript
import type { RegisterUserInput } from ''

// TODO: Update the object below with actual values
const example = {
  "email": null,
  "userName": null,
  "name": null,
  "password": null,
  "confirmPassword": null,
  "dateOfBirth": null,
  "weight": null,
  "height": null,
} satisfies RegisterUserInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RegisterUserInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


