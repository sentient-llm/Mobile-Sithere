import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.session == nil {
                LoginView()
            } else if model.role == .walker {
                WalkerTabView()
            } else {
                OwnerTabView()
            }
        }
        .tint(.teal)
        .overlay(alignment: .top) {
            if let message = model.errorMessage {
                Text(message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.red, in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}
