# AuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authControllerLogin**](AuthApi.md#authcontrollerlogin) | **POST** /auth/login |  |
| [**authControllerRegister**](AuthApi.md#authcontrollerregister) | **POST** /auth/register |  |



## authControllerLogin

> AuthPayload authControllerLogin(loginInput)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerLoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // LoginInput
    loginInput: ...,
  } satisfies AuthControllerLoginRequest;

  try {
    const data = await api.authControllerLogin(body);
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
| **loginInput** | [LoginInput](LoginInput.md) |  | |

### Return type

[**AuthPayload**](AuthPayload.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authControllerRegister

> AuthPayload authControllerRegister(registerUserInput)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerRegisterRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RegisterUserInput
    registerUserInput: ...,
  } satisfies AuthControllerRegisterRequest;

  try {
    const data = await api.authControllerRegister(body);
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
| **registerUserInput** | [RegisterUserInput](RegisterUserInput.md) |  | |

### Return type

[**AuthPayload**](AuthPayload.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

