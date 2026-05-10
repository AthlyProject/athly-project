
# CreateWaitlistEntryDto


## Properties

Name | Type
------------ | -------------
`name` | string
`email` | string

## Example

```typescript
import type { CreateWaitlistEntryDto } from ''

// TODO: Update the object below with actual values
const example = {
  "name": João Silva,
  "email": joao@email.com,
} satisfies CreateWaitlistEntryDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateWaitlistEntryDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


