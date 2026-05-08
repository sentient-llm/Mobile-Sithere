import SwiftUI

@main
struct SitHereApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .task {
                    appDelegate.model = model
                    await model.restoreSession()
                }
        }
    }
}
