import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushService: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var authorizationGranted = false
    @Published var deviceToken: String?

    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            authorizationGranted = granted
            if granted {
                UNUserNotificationCenter.current().delegate = self
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            authorizationGranted = false
        }
    }

    func setDeviceToken(_ data: Data) {
        deviceToken = data.map { String(format: "%02.2hhx", $0) }.joined()
    }
}
