package com.nativephp.mobile.bridge.functions

import android.content.Intent
import android.net.Uri
import android.os.SystemClock
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
     * How long a genuinely displayed overlay must take, at minimum.
     *
     * Play reports nothing about whether it drew anything, and reports success
     * either way, so elapsed time is the only signal available. A real overlay
     * waits on a human, so it cannot finish in milliseconds; a no-op returns
     * almost instantly (measured at ~5ms on a non-Play install).
     */
    private const val SHOWN_THRESHOLD_MS = 1_000L

    /**
     * Ask Play to show the in-app review overlay, falling back to the store
     * listing when it declines to show anything.
     *
     * The fallback is what stops a tap on "rate" from doing nothing at all.
     * Play shows no overlay when the quota is spent, when the user already
     * reviewed, or when the build was not installed from Play, and in every one
     * of those cases it still reports success, so the fallback cannot key off
     * the result. It keys off how fast the flow completed instead.
     *
     * The return value means only that the request was handed off. It is never
     * a claim that the user saw or wrote anything.
     */
    class Request(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val storeUrl = parameters["store_url"] as? String

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
                            openStoreListing(storeUrl)
                            return@addOnCompleteListener
                        }

                        val startedAt = SystemClock.elapsedRealtime()

                        manager.launchReviewFlow(activity, request.result)
                            .addOnCompleteListener {
                                val elapsed = SystemClock.elapsedRealtime() - startedAt

                                if (elapsed < SHOWN_THRESHOLD_MS) {
                                    Log.d(
                                        "Review.Request",
                                        "↪️ Flow returned in ${elapsed}ms, so nothing was shown; opening the store"
                                    )
                                    openStoreListing(storeUrl)
                                } else {
                                    Log.d("Review.Request", "✅ Overlay shown, flow finished in ${elapsed}ms")
                                }
                            }
                    }
                }

                mapOf("success" to true)
            } catch (e: Exception) {
                Log.e("Review.Request", "❌ Error requesting review: ${e.message}", e)
                throw BridgeError.ExecutionFailed("Failed to request review: ${e.message}")
            }
        }

        /**
         * Last resort so the user always lands somewhere they can rate.
         */
        private fun openStoreListing(storeUrl: String?) {
            if (storeUrl.isNullOrBlank()) {
                Log.w("Review.Request", "⚠️ No store_url supplied, nothing to fall back to")
                return
            }

            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(storeUrl))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(intent)
                Log.d("Review.Request", "✅ Opened the store listing instead")
            } catch (e: Exception) {
                Log.e("Review.Request", "❌ Could not open the store listing: ${e.message}", e)
            }
        }
    }
}
