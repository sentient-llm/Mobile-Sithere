import SwiftUI

struct ChatListView: View {
    @EnvironmentObject private var model: AppModel
    @State private var conversations: [Conversation] = []

    var body: some View {
        NavigationStack {
            List(conversations) { conversation in
                NavigationLink {
                    ChatThreadView(conversation: conversation)
                } label: {
                    VStack(alignment: .leading) {
                        Text("Conversation")
                            .font(.headline)
                        Text(conversation.id.uuidString)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .overlay {
                if conversations.isEmpty {
                    ContentUnavailableView("No conversations", systemImage: "bubble.left.and.bubble.right")
                }
            }
            .navigationTitle("Chat")
            .task { await load() }
        }
    }

    private func load() async {
        do {
            conversations = try await model.apiClient.conversations(token: model.tokenOrThrow())
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct ChatThreadView: View {
    @EnvironmentObject private var model: AppModel
    let conversation: Conversation
    @State private var messages: [Message] = []
    @State private var draft = ""

    var body: some View {
        VStack {
            List(messages) { message in
                Text(message.body)
            }
            HStack {
                TextField("Message", text: $draft)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    Task { await send() }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .navigationTitle("Messages")
        .task { await load() }
    }

    private func load() async {
        do {
            messages = try await model.apiClient.messages(token: model.tokenOrThrow(), conversationId: conversation.id)
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    private func send() async {
        do {
            let sent = try await model.apiClient.sendMessage(token: model.tokenOrThrow(), conversationId: conversation.id, body: draft)
            messages.append(sent)
            draft = ""
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct ReportsView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView("Reports arrive after walks", systemImage: "doc.text", description: Text("The production API supports reports and ratings; report list loading is ready for the next UI pass."))
                .navigationTitle("Reports")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Name", value: model.me?.profile.fullName ?? "Unknown")
                    LabeledContent("Email", value: model.me?.profile.email ?? "Unknown")
                    LabeledContent("Role", value: model.role.rawValue.capitalized)
                }
                Section("Privacy") {
                    Link("Privacy Policy", destination: URL(string: "https://sithere.app/privacy")!)
                    Button("Delete Account", role: .destructive) {
                        Task {
                            do {
                                try await model.apiClient.deleteAccount(token: model.tokenOrThrow())
                                model.signOut()
                            } catch {
                                model.errorMessage = error.localizedDescription
                            }
                        }
                    }
                }
                Section {
                    Button("Sign Out", role: .destructive) {
                        model.signOut()
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
}
