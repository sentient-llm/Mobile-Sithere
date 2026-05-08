import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    weak var model: AppModel?

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            model?.pushService.setDeviceToken(deviceToken)
            guard let model, let token = model.session?.accessToken, let deviceToken = model.pushService.deviceToken else { return }
            try? await model.apiClient.registerDeviceToken(token: token, deviceToken: deviceToken, environmentName: "sandbox")
        }
    }
}
