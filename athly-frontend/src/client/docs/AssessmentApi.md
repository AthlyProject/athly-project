# AssessmentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**assessmentControllerFindMine**](AssessmentApi.md#assessmentcontrollerfindmine) | **GET** /assessment | Get the current user assessment answers |
| [**assessmentControllerSubmit**](AssessmentApi.md#assessmentcontrollersubmit) | **POST** /assessment | Submit the onboarding assessment |



## assessmentControllerFindMine

> object assessmentControllerFindMine()

Get the current user assessment answers

### Example

```ts
import {
  Configuration,
  AssessmentApi,
} from '';
import type { AssessmentControllerFindMineRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AssessmentApi(config);

  try {
    const data = await api.assessmentControllerFindMine();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## assessmentControllerSubmit

> assessmentControllerSubmit(submitAssessmentDto)

Submit the onboarding assessment

### Example

```ts
import {
  Configuration,
  AssessmentApi,
} from '';
import type { AssessmentControllerSubmitRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AssessmentApi(config);

  const body = {
    // SubmitAssessmentDto
    submitAssessmentDto: ...,
  } satisfies AssessmentControllerSubmitRequest;

  try {
    const data = await api.assessmentControllerSubmit(body);
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
| **submitAssessmentDto** | [SubmitAssessmentDto](SubmitAssessmentDto.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

