import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.parcelize)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

// Lê segredos/config de local.properties (gitignored). Espelha o DEV_API_URL/Config.xcconfig do iOS.
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val prodApiUrl = "https://api.athlyproject.app"
val devApiUrl: String = (localProps.getProperty("DEV_API_URL") ?: "").trim()
val mapsApiKey: String = (localProps.getProperty("MAPS_API_KEY") ?: "").trim()
// Backend MOCK (offline, sem credenciais) — só no debug e opt-in via local.properties. Espelha o swap
// por `#if targetEnvironment(simulator)` do iOS (MockHealthKitService). Vazio/false ⇒ backend real,
// então builds de device físico/release ficam intactos.
val mockBackend: Boolean = (localProps.getProperty("MOCK_BACKEND") ?: "").trim().equals("true", ignoreCase = true)

android {
    namespace = "com.athly.runner"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.athly.runner"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
        vectorDrawables { useSupportLibrary = true }
    }

    buildTypes {
        debug {
            // Debug usa o backend local (DEV_API_URL) quando definido; senão produção.
            buildConfigField("String", "BASE_URL", "\"${devApiUrl.ifEmpty { prodApiUrl }}\"")
            // MOCK_BACKEND só existe no debug; release é sempre false (backend real).
            buildConfigField("Boolean", "MOCK_BACKEND", "$mockBackend")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "BASE_URL", "\"$prodApiUrl\"")
            buildConfigField("Boolean", "MOCK_BACKEND", "false")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.bundles.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(libs.bundles.network)

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.play.services.location)
    implementation(libs.maps.compose)
    implementation(libs.play.services.maps)
    implementation(libs.androidx.health.connect)
    implementation(libs.coil.compose)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}
