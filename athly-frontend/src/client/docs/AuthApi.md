# AuthApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authControllerGetStravaAuthUrl**](AuthApi.md#authcontrollergetstravaauthurl) | **GET** /auth/strava/url |  |
| [**authControllerLogin**](AuthApi.md#authcontrollerlogin) | **POST** /auth/login |  |
| [**authControllerRefresh**](AuthApi.md#authcontrollerrefresh) | **POST** /auth/refresh |  |
| [**authControllerRegister**](AuthApi.md#authcontrollerregister) | **POST** /auth/register |  |
| [**authControllerStravaCallback**](AuthApi.md#authcontrollerstravacallback) | **POST** /auth/strava/callback |  |
| [**authControllerVerifyEmail**](AuthApi.md#authcontrollerverifyemail) | **POST** /auth/verify-email |  |



## authControllerGetStravaAuthUrl

> AuthControllerGetStravaAuthUrl200Response authControllerGetStravaAuthUrl()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerGetStravaAuthUrlRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  try {
    const data = await api.authControllerGetStravaAuthUrl();
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

[**AuthControllerGetStravaAuthUrl200Response**](AuthControllerGetStravaAuthUrl200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authControllerLogin

> AuthPayload authControllerLogin(loginDto)



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
    // LoginDto
    loginDto: ...,
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
| **loginDto** | [LoginDto](LoginDto.md) |  | |

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


## authControllerRefresh

> AuthControllerRefresh200Response authControllerRefresh(refreshTokenDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerRefreshRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RefreshTokenDto
    refreshTokenDto: ...,
  } satisfies AuthControllerRefreshRequest;

  try {
    const data = await api.authControllerRefresh(body);
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
| **refreshTokenDto** | [RefreshTokenDto](RefreshTokenDto.md) |  | |

### Return type

[**AuthControllerRefresh200Response**](AuthControllerRefresh200Response.md)

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

> AuthPayload authControllerRegister(registerUserDto)



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
    // RegisterUserDto
    registerUserDto: ...,
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
| **registerUserDto** | [RegisterUserDto](RegisterUserDto.md) |  | |

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


## authControllerStravaCallback

> AuthPayload authControllerStravaCallback(stravaCallbackDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerStravaCallbackRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // StravaCallbackDto
    stravaCallbackDto: ...,
  } satisfies AuthControllerStravaCallbackRequest;

  try {
    const data = await api.authControllerStravaCallback(body);
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
| **stravaCallbackDto** | [StravaCallbackDto](StravaCallbackDto.md) |  | |

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


## authControllerVerifyEmail

> AuthControllerVerifyEmail200Response authControllerVerifyEmail(verifyEmailDto)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthControllerVerifyEmailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // VerifyEmailDto
    verifyEmailDto: ...,
  } satisfies AuthControllerVerifyEmailRequest;

  try {
    const data = await api.authControllerVerifyEmail(body);
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
| **verifyEmailDto** | [VerifyEmailDto](VerifyEmailDto.md) |  | |

### Return type

[**AuthControllerVerifyEmail200Response**](AuthControllerVerifyEmail200Response.md)

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

