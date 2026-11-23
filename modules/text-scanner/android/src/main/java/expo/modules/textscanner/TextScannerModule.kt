package expo.modules.textscanner

import android.graphics.Point
import android.graphics.Rect
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.atan2

// Reads the text in a photo on the phone and returns every line with where it sits on the page,
// so the app can put a bill's label and amount columns back into rows.
class TextScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TextScanner")

    AsyncFunction("recognize") { uriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw IllegalStateException("App is not ready")
        val uri = when {
          uriString.startsWith("content://") || uriString.startsWith("file://") -> Uri.parse(uriString)
          else -> Uri.fromFile(File(uriString))
        }
        // Applies the photo's EXIF rotation, so positions match the upright image
        val image = InputImage.fromFilePath(context, uri)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { block ->
              block.lines.map { line ->
                box(line.boundingBox) + mapOf(
                  "text" to line.text,
                  "angle" to angle(line.cornerPoints)
                )
              }
            }
            promise.resolve(mapOf("width" to image.width, "height" to image.height, "lines" to lines))
            recognizer.close()
          }
          .addOnFailureListener { error ->
            promise.reject(CodedException("ERR_RECOGNIZE", error.message ?: "Couldn't read the image", error))
            recognizer.close()
          }
      } catch (error: Exception) {
        promise.reject(CodedException("ERR_IMAGE", error.message ?: "Couldn't open the image", error))
      }
    }
  }

  // How much a line slopes, in degrees: photos are rarely held perfectly straight
  private fun angle(corners: Array<Point>?): Double {
    if (corners == null || corners.size < 2) return 0.0
    val (topLeft, topRight) = corners
    return Math.toDegrees(atan2((topRight.y - topLeft.y).toDouble(), (topRight.x - topLeft.x).toDouble()))
  }

  private fun box(rect: Rect?): Map<String, Int> = mapOf(
    "left" to (rect?.left ?: 0),
    "top" to (rect?.top ?: 0),
    "right" to (rect?.right ?: 0),
    "bottom" to (rect?.bottom ?: 0)
  )
}
