package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.apiCall
import com.athly.runner.core.network.apiCallUnit
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.UpdateProfileRequest
import com.athly.runner.data.remote.dto.UserProfileDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val api: ApiService,
) {

    suspend fun getProfile(): AthlyResult<UserProfileDto> =
        apiCall { api.getUserProfile() }

    suspend fun updateProfile(request: UpdateProfileRequest): AthlyResult<UserProfileDto> =
        apiCall { api.updateProfile(request) }

    /** Exclui a conta e todos os dados relacionados no servidor. */
    suspend fun deleteAccount(): AthlyResult<Unit> =
        apiCallUnit { api.deleteAccount() }
}
