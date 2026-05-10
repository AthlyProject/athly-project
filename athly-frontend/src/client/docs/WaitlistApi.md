# WaitlistApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**waitlistControllerCreate**](WaitlistApi.md#waitlistcontrollercreate) | **POST** /waitlist | Cadastrar na lista de espera |



## waitlistControllerCreate

> waitlistControllerCreate(createWaitlistEntryDto)

Cadastrar na lista de espera

### Example

```ts
import {
  Configuration,
  WaitlistApi,
} from '';
import type { WaitlistControllerCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new WaitlistApi();

  const body = {
    // CreateWaitlistEntryDto
    createWaitlistEntryDto: ...,
  } satisfies WaitlistControllerCreateRequest;

  try {
    const data = await api.waitlistControllerCreate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createWaitlistEntryDto** | [CreateWaitlistEntryDto](CreateWaitlistEntryDto.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

