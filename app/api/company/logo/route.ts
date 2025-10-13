import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { CompanySettingsService } from "@/lib/services/company-settings-service"
import { HTTP_STATUS } from "@/lib/types/api"

// POST /api/company/logo - Upload company logo
export const POST = withErrorHandler(
  withRateLimit(10, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return Response.json(
        { success: false, error: "No file provided" },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const settingsService = new CompanySettingsService(userId)
    const result = await settingsService.uploadLogo(file)

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      message: "Logo uploaded successfully"
    }, { status: HTTP_STATUS.CREATED })
  })
)

// DELETE /api/company/logo - Delete company logo
export const DELETE = withErrorHandler(
  withRateLimit(10, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const settingsService = new CompanySettingsService(userId)
    const result = await settingsService.deleteLogo()

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: { deleted: true },
      message: "Logo deleted successfully"
    })
  })
)