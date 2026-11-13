// Mushaf Reader for Android: a Trusted Web Activity that opens https://maazarif.github.io/quran-app/
// full-screen through Chrome, verified by https://maazarif.github.io/.well-known/assetlinks.json
plugins { id("com.android.application") }

android {
    namespace = "io.github.maazarif.mushaf"
    compileSdk = 36
    defaultConfig {
        applicationId = "io.github.maazarif.mushaf"
        minSdk = 24                         // Android 7.0, the oldest the TWA library supports
        targetSdk = 36                      // Google Play requires Android 16 (API 36) since 31 August 2026
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }
    signingConfigs {
        // Test builds: a non-secret key kept in the repository, so anyone can install them (not for Google Play)
        create("preview") {
            storeFile = file("preview.keystore"); storeType = "pkcs12"
            storePassword = "preview-builds"; keyAlias = "preview"; keyPassword = "preview-builds"
        }
        // Google Play builds: the upload key, provided by GitHub secrets (see android/README.md)
        val ks = System.getenv("ANDROID_KEYSTORE_PATH")
        if (ks != null) create("upload") {
            storeFile = file(ks); storeType = "pkcs12"
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD"); keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "upload"
            keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("upload")
        }
        create("preview") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("preview")
            matchingFallbacks += listOf("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
