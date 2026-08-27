package com.nativephp.mobile.bridge.functions

import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.google.android.play.core.review.ReviewManagerFactory
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction

/**
 * Google Play in-app review overlay.
 * Namespace: "Review.*"
 *
 * Local addition, not part of upstream NativePHP. Copied into the generated
 * tree by scripts/patch-nativephp-android.py after every native:install.
 */
object ReviewFunctions {

    /**
     * Ask Play to show the in-app review overlay.
     *
     * Returns as soon as the request has been handed off, because there is
     * nothing else to report: the Play API never says whether the user rated,
     * dismissed, or saw anything at all, and it shows nothing when the quota is
     * spent, when the user already reviewed, or when the build was not
     * installed from Play. Callers must treat "handed off" as the end of the
     * story and gate nothing on the outcome.
     */
    class Request(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return try {
                // The Play library must be driven from the main thread. The bridge
                // runs on whichever thread served the PHP request, so hop across.
                activity.runOnUiThread {
                    if (activity.isFinishing || activity.isDestroyed) {
                        Log.d("Review.Request", "⏹ Activity gone, skipping review flow")
                        return@runOnUiThread
                    }

                    val manager = ReviewManagerFactory.create(activity)

                    manager.requestReviewFlow().addOnCompleteListener { request ->
                        if (!request.isSuccessful) {
                            Log.w(
                                "Review.Request",
                                "⚠️ Play declined the review request: ${request.exception?.message}"
                            )
                            return@addOnCompleteListener
                        }

                        manager.launchReviewFlow(activity, request.result)
                            .addOnCompleteListener {
                                // Completes either way, with or without an overlay shown.
                                Log.d("Review.Request", "✅ Review flow finished")
                            }
                    }
                }

                mapOf("success" to true)
            } catch (e: Exception) {
                Log.e("Review.Request", "❌ Error requesting review: ${e.message}", e)
                throw BridgeError.ExecutionFailed("Failed to request review: ${e.message}")
            }
        }
    }
}
